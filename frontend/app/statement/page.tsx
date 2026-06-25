"use client";

import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { downloadAuthenticatedFile, fetchJson } from "../../lib/auth";
import { formatDualCurrency, Money, useDisplayCurrency } from "../../lib/currency";

type Customer = {
  id: number;
  name: string;
  mobile?: string;
};

type StatementRow = {
  date: string;
  type: string;
  amount: number;
  balance: number;
};

const dateFormatter = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function formatDate(value?: string) {
  if (!value) {
    return "No date";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return dateFormatter.format(date);
}

function normalizeType(value?: string) {
  if (!value) {
    return "Entry";
  }

  return value
    .split(/[_-\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

export default function Statement() {
  const params = useSearchParams();
  const customerIdFromURL = params.get("customer") ?? "";

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerId, setCustomerId] = useState(customerIdFromURL);
  const [rows, setRows] = useState<StatementRow[]>([]);
  const [status, setStatus] = useState("");
  const [loadingCustomers, setLoadingCustomers] = useState(true);
  const [loadingStatement, setLoadingStatement] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const displayCurrency = useDisplayCurrency();

  const activeCustomerId = customerId || customerIdFromURL;
  const validActiveCustomerId = /^\d+$/.test(activeCustomerId) ? activeCustomerId : "";

  useEffect(() => {
    setCustomerId(customerIdFromURL);
  }, [customerIdFromURL]);

  useEffect(() => {
    let ignore = false;

    async function loadCustomers() {
      setLoadingCustomers(true);

      try {
        const result = await fetchJson<Customer[]>("/customers");
        if (!ignore) {
          setCustomers(result);
        }
      } catch (error) {
        if (!ignore) {
          setStatus(error instanceof Error ? error.message : "Could not load customers.");
        }
      } finally {
        if (!ignore) {
          setLoadingCustomers(false);
        }
      }
    }

    loadCustomers();

    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;

    async function loadStatement(id: string) {
      if (!id) {
        setRows([]);
        setLoadingStatement(false);
        return;
      }

      setLoadingStatement(true);
      setStatus("");

      try {
        const result = await fetchJson<StatementRow[]>(`/ledger/statement/${id}`);
        if (!ignore) {
          setRows(result);
        }
      } catch (error) {
        if (!ignore) {
          setRows([]);
          setStatus(error instanceof Error ? error.message : "Could not load statement.");
        }
      } finally {
        if (!ignore) {
          setLoadingStatement(false);
        }
      }
    }

    loadStatement(validActiveCustomerId);

    return () => {
      ignore = true;
    };
  }, [validActiveCustomerId]);

  const selectedCustomer = useMemo(
    () => customers.find((item) => String(item.id) === String(validActiveCustomerId)) ?? null,
    [validActiveCustomerId, customers]
  );

  const totals = useMemo(() => {
    return rows.reduce(
      (summary, row) => {
        const amount = Number(row.amount);

        if (amount >= 0) {
          summary.charges += amount;
        } else {
          summary.receipts += Math.abs(amount);
        }

        summary.charges = Number(summary.charges.toFixed(3));
        summary.receipts = Number(summary.receipts.toFixed(3));
        summary.closingBalance = Number(row.balance);

        return summary;
      },
      {
        charges: 0,
        receipts: 0,
        closingBalance: 0,
      }
    );
  }, [rows]);

  const downloadStatementPdf = async () => {
    if (!validActiveCustomerId || !selectedCustomer) {
      setStatus("Select a customer before downloading the statement PDF.");
      return;
    }

    setDownloadingPdf(true);
    setStatus("");

    try {
      await downloadAuthenticatedFile(
        `/ledger/statement/${validActiveCustomerId}/pdf?currency=${displayCurrency}`,
        `statement-${selectedCustomer.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${validActiveCustomerId}.pdf`
      );
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not download statement PDF.");
    } finally {
      setDownloadingPdf(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="panel overflow-hidden">
        <div className="bg-[radial-gradient(circle_at_top_right,rgba(225,29,46,0.18),transparent_30%),linear-gradient(135deg,#fffdfb_0%,#fff4f4_42%,#f6efe9_100%)] p-6 md:p-8">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <p className="soft-label">Ledger Statement</p>
              <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                Customer account statement
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-slate-600">
                Review running balance, charges, and receipts for each customer in one
                cleaner ledger view.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 xl:min-w-[32rem]">
              <MetricCard label="Charges" value={totals.charges} tone="warm" />
              <MetricCard label="Receipts" value={totals.receipts} tone="cool" />
              <MetricCard
                label="Closing Balance"
                value={totals.closingBalance}
                tone="dark"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <div className="space-y-6">
          <div className="panel p-6 md:p-8">
            <p className="soft-label">Choose Customer</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">Load a statement</h2>

            <div className="mt-6">
              <select
                className="field"
                onChange={(event) => setCustomerId(event.target.value)}
                value={validActiveCustomerId}
                disabled={loadingCustomers}
              >
                <option value="">Select customer</option>
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </div>

            <button
              className="btn-primary mt-4 w-full"
              onClick={downloadStatementPdf}
              disabled={!validActiveCustomerId || downloadingPdf}
            >
              {downloadingPdf ? "Preparing PDF..." : "Download Statement PDF"}
            </button>

            <div className="mt-6 rounded-[24px] border border-slate-200 bg-slate-50/80 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                Current Selection
              </p>
              <p className="mt-3 text-xl font-bold text-slate-950">
                {selectedCustomer?.name ?? "No customer selected"}
              </p>
              <p className="mt-2 text-sm text-slate-600">
                {selectedCustomer?.mobile
                  ? `Contact: ${selectedCustomer.mobile}`
                  : "Pick a customer to review their full ledger activity."}
              </p>
            </div>

            {status ? (
              <div className="mt-6 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {status}
              </div>
            ) : null}
          </div>

          <div className="panel p-6 md:p-8">
            <p className="soft-label">Statement Summary</p>
            <div className="mt-5 space-y-4">
              <SummaryRow label="Opening entries" value={String(rows.length)} />
              <SummaryRow label="Total charges" value={formatDualCurrency(totals.charges)} />
              <SummaryRow label="Total receipts" value={formatDualCurrency(totals.receipts)} />
              <SummaryRow label="Running balance" value={formatDualCurrency(totals.closingBalance)} />
            </div>
          </div>
        </div>

        <div className="panel p-6 md:p-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="soft-label">Transactions</p>
              <h2 className="mt-2 text-2xl font-bold text-slate-950">Ledger activity</h2>
            </div>
            {loadingStatement ? (
              <span className="status-pill bg-amber-100 text-amber-800">Loading statement…</span>
            ) : rows.length ? (
              <span className="status-pill bg-emerald-100 text-emerald-800">
                {rows.length} entries loaded
              </span>
            ) : (
              <span className="status-pill bg-slate-100 text-slate-700">No entries yet</span>
            )}
          </div>

          {!validActiveCustomerId && !loadingStatement ? (
            <div className="mt-6 rounded-[28px] border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="text-lg font-semibold text-slate-900">Choose a customer first</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                The statement table will appear here once a customer is selected.
              </p>
            </div>
          ) : null}

          {validActiveCustomerId && !loadingStatement && !rows.length && !status ? (
            <div className="mt-6 rounded-[28px] border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
              <p className="text-lg font-semibold text-slate-900">No ledger entries found</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                This customer does not have any statement activity yet.
              </p>
            </div>
          ) : null}

          {rows.length ? (
            <div className="mt-6 overflow-hidden rounded-[28px] border border-slate-200">
              <div className="hidden grid-cols-[1fr_1.1fr_0.9fr_0.9fr] gap-4 bg-slate-950 px-5 py-4 text-xs font-semibold uppercase tracking-[0.16em] text-white/70 md:grid">
                <div>Date</div>
                <div>Type</div>
                <div className="text-right">Amount</div>
                <div className="text-right">Balance</div>
              </div>

              <div className="divide-y divide-slate-200 bg-white">
                {rows.map((row, index) => {
                  const isCredit = row.amount < 0;

                  return (
                    <div
                      key={`${row.date}-${row.type}-${index}`}
                      className="grid gap-3 px-5 py-4 md:grid-cols-[1fr_1.1fr_0.9fr_0.9fr] md:items-center md:gap-4"
                    >
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 md:hidden">
                          Date
                        </p>
                        <p className="text-sm font-semibold text-slate-900">
                          {formatDate(row.date)}
                        </p>
                      </div>

                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 md:hidden">
                          Type
                        </p>
                        <p className="text-sm text-slate-700">{normalizeType(row.type)}</p>
                      </div>

                      <div className="md:text-right">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 md:hidden">
                          Amount
                        </p>
                        <p
                          className={`text-sm font-bold ${
                            isCredit ? "text-emerald-700" : "text-red-600"
                          }`}
                        >
                          {isCredit ? "-" : "+"}
                          {formatDualCurrency(Math.abs(row.amount))}
                        </p>
                      </div>

                      <div className="md:text-right">
                        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500 md:hidden">
                          Balance
                        </p>
                        <p className="text-sm font-semibold text-slate-900">
                          {formatDualCurrency(row.balance)}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function MetricCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "warm" | "cool" | "dark";
}) {
  const toneClass =
    tone === "warm"
      ? "bg-white text-slate-950"
      : tone === "cool"
        ? "bg-slate-950 text-white"
        : "bg-[linear-gradient(135deg,#e11d2e_0%,#7f1d1d_100%)] text-white";

  return (
    <div className={`rounded-[24px] p-5 shadow-lg [container-type:inline-size] ${toneClass}`}>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] opacity-75">{label}</p>
      <p className="mt-4 max-w-full text-[clamp(1.75rem,12cqw,2.7rem)] font-black leading-none tracking-normal"><Money value={value} /></p>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <span className="text-sm font-medium text-slate-600">{label}</span>
      <span className="text-base font-bold text-slate-950">{value}</span>
    </div>
  );
}
