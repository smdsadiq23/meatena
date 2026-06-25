"use client";

import { useEffect, useMemo, useState } from "react";
import { downloadAuthenticatedFile, fetchJson, fetchJsonOrThrow } from "../../lib/auth";
import { formatDualCurrency, Money, useDisplayCurrency } from "../../lib/currency";

type Supplier = {
  id: number;
  name: string;
  mobile?: string;
  address?: string;
  balance: number;
};

type SupplierPayment = {
  id: number;
  supplier_id: number;
  amount: number;
  mode: string;
  reference_no?: string | null;
  note?: string | null;
  date: string;
};

type SupplierStatementRow = {
  id: string;
  date: string;
  type: "purchase" | "payment";
  reference: string;
  description: string;
  invoice_no?: string | null;
  purchase_date?: string | null;
  goods_received_date?: string | null;
  subtotal: number;
  discount_amount: number;
  advance_paid: number;
  balance_due: number;
  weight: number;
  transaction_currency: "KWD" | "USD";
  exchange_rate: number;
  charge: number;
  payment: number;
  balance: number;
};

type SupplierStatement = {
  supplier: Supplier;
  rows: SupplierStatementRow[];
  totals: {
    charges: number;
    payments: number;
    discounts: number;
    closing_balance: number;
  };
};

const emptySupplier = { name: "", mobile: "", address: "" };
const emptyPayment = {
  supplier_id: "",
  amount: "",
  mode: "cash",
  reference_no: "",
  note: "",
};

function formatDate(value?: string | null) {
  if (!value) {
    return "-";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [form, setForm] = useState(emptySupplier);
  const [paymentForm, setPaymentForm] = useState(emptyPayment);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState<"success" | "error">("success");
  const [loading, setLoading] = useState(false);
  const [statement, setStatement] = useState<SupplierStatement | null>(null);
  const [statementLoading, setStatementLoading] = useState(false);
  const displayCurrency = useDisplayCurrency();

  const loadSuppliers = async (preserveStatus = false) => {
    if (!preserveStatus) {
      setStatus("");
    }

    try {
      const [supplierData, paymentData] = await Promise.all([
        fetchJson<Supplier[]>("/suppliers"),
        fetchJson<SupplierPayment[]>("/supplier-payments"),
      ]);
      setSuppliers(Array.isArray(supplierData) ? supplierData : []);
      setPayments(Array.isArray(paymentData) ? paymentData : []);
    } catch (error) {
      setStatusType("error");
      setStatus(error instanceof Error ? error.message : "Could not load suppliers.");
    }
  };

  useEffect(() => {
    Promise.all([
      fetchJson<Supplier[]>("/suppliers"),
      fetchJson<SupplierPayment[]>("/supplier-payments"),
    ])
      .then(([supplierData, paymentData]) => {
        setSuppliers(Array.isArray(supplierData) ? supplierData : []);
        setPayments(Array.isArray(paymentData) ? paymentData : []);
      })
      .catch((error: Error) => {
        setStatusType("error");
        setStatus(error.message || "Could not load suppliers.");
      });
  }, []);

  const filteredSuppliers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      return suppliers;
    }

    return suppliers.filter((supplier) =>
      [supplier.name, supplier.mobile, supplier.address]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(keyword))
    );
  }, [search, suppliers]);

  const supplierNameById = useMemo(
    () => new Map(suppliers.map((supplier) => [supplier.id, supplier.name])),
    [suppliers]
  );

  const totalSupplierBalance = useMemo(
    () => suppliers.reduce((sum, supplier) => sum + Number(supplier.balance ?? 0), 0),
    [suppliers]
  );

  const createSupplier = async () => {
    if (!form.name.trim()) {
      setStatusType("error");
      setStatus("Supplier name is required.");
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      await fetchJsonOrThrow("/suppliers", {
        method: "POST",
        body: JSON.stringify(form),
      });
      setForm(emptySupplier);
      setStatusType("success");
      setStatus("Supplier created successfully.");
      await loadSuppliers(true);
    } catch (error) {
      setStatusType("error");
      setStatus(error instanceof Error ? error.message : "Could not create supplier.");
    } finally {
      setLoading(false);
    }
  };

  const recordSupplierPayment = async () => {
    if (!paymentForm.supplier_id || !Number(paymentForm.amount)) {
      setStatusType("error");
      setStatus("Choose a supplier and enter a payment amount.");
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      await fetchJsonOrThrow("/supplier-payments", {
        method: "POST",
        body: JSON.stringify({
          supplier_id: Number(paymentForm.supplier_id),
          amount: Number(paymentForm.amount),
          mode: paymentForm.mode,
          reference_no: paymentForm.reference_no || undefined,
          note: paymentForm.note || undefined,
        }),
      });
      setPaymentForm(emptyPayment);
      setStatusType("success");
      setStatus("Supplier payment recorded.");
      await loadSuppliers(true);
    } catch (error) {
      setStatusType("error");
      setStatus(error instanceof Error ? error.message : "Could not record supplier payment.");
    } finally {
      setLoading(false);
    }
  };

  const deleteSupplier = async (supplier: Supplier) => {
    if (
      !window.confirm(
        `Delete supplier "${supplier.name}"? Suppliers with purchases, payments, or balances cannot be deleted.`
      )
    ) {
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      const response = await fetchJsonOrThrow<{ message: string }>(`/suppliers/${supplier.id}`, {
        method: "DELETE",
      });
      setStatusType("success");
      setStatus(response.message);
      await loadSuppliers(true);
    } catch (error) {
      setStatusType("error");
      setStatus(error instanceof Error ? error.message : "Could not delete supplier.");
    } finally {
      setLoading(false);
    }
  };

  const openSupplierStatement = async (supplier: Supplier) => {
    setStatementLoading(true);
    setStatus("");

    try {
      const data = await fetchJson<SupplierStatement>(`/suppliers/${supplier.id}/statement`);
      setStatement(data);
    } catch (error) {
      setStatusType("error");
      setStatus(error instanceof Error ? error.message : "Could not load supplier statement.");
    } finally {
      setStatementLoading(false);
    }
  };

  const downloadSupplierStatement = async (supplier: Supplier) => {
    setStatus("");

    try {
      await downloadAuthenticatedFile(
        `/suppliers/${supplier.id}/statement/pdf?currency=${displayCurrency}`,
        `supplier-ledger-${supplier.id}.pdf`
      );
    } catch (error) {
      setStatusType("error");
      setStatus(error instanceof Error ? error.message : "Could not download supplier statement.");
    }
  };

  return (
    <>
    <section className="panel p-5 md:p-7">
      <div className="flex flex-col gap-4 border-b border-slate-100 pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div>
          <p className="soft-label">Supplier Directory</p>
          <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
            Suppliers and balances
          </h1>
          <p className="mt-2 text-sm font-medium text-slate-500">
            Add suppliers, settle payments, open ledgers, and review recent supplier activity from one screen.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[420px]">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="soft-label">Suppliers</p>
            <p className="mt-2 text-2xl font-black text-slate-950">{suppliers.length}</p>
          </div>
          <div className="rounded-2xl bg-red-50 p-4">
            <p className="soft-label">Payable Balance</p>
            <p className="mt-2 text-2xl font-black text-red-700">
              <Money value={totalSupplierBalance} />
            </p>
          </div>
        </div>
      </div>

      {status ? (
        <div
          className={`mt-5 rounded-2xl px-4 py-3 text-sm font-medium ${
            statusType === "error"
              ? "border border-red-100 bg-red-50 text-red-700"
              : "border border-emerald-100 bg-emerald-50 text-emerald-700"
          }`}
        >
          {status}
        </div>
      ) : null}

      <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="min-w-0">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <input
              className="field md:max-w-md"
              placeholder="Search suppliers"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-black text-slate-700">
              {filteredSuppliers.length} shown
            </span>
          </div>

          <div className="mt-4 overflow-hidden rounded-3xl border border-slate-200">
            <div className="hidden grid-cols-[1.3fr_1fr_1fr_280px] gap-4 bg-slate-950 px-5 py-3 text-xs font-black uppercase tracking-[0.16em] text-white lg:grid">
              <span>Supplier</span>
              <span>Contact</span>
              <span className="text-right">Balance</span>
              <span className="text-right">Actions</span>
            </div>
            <div className="divide-y divide-slate-100">
              {filteredSuppliers.map((supplier) => (
                <div
                  key={supplier.id}
                  className="grid gap-4 bg-white px-5 py-4 lg:grid-cols-[1.3fr_1fr_1fr_280px] lg:items-center"
                >
                  <div className="min-w-0">
                    <p className="truncate text-base font-black text-slate-950">{supplier.name}</p>
                    <p className="mt-1 text-sm font-medium text-slate-500">{supplier.address || "No address"}</p>
                  </div>
                  <div className="text-sm font-medium text-slate-600">
                    {supplier.mobile || "No mobile"}
                  </div>
                  <div className="lg:text-right">
                    <p className="soft-label lg:hidden">Balance</p>
                    <p className="text-xl font-black text-red-600">
                      <Money value={supplier.balance ?? 0} />
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <button
                      type="button"
                      className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => void openSupplierStatement(supplier)}
                      disabled={statementLoading}
                    >
                      Statement
                    </button>
                    <button
                      type="button"
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-900 transition hover:bg-slate-50"
                      onClick={() => void downloadSupplierStatement(supplier)}
                    >
                      PDF
                    </button>
                    <button
                      type="button"
                      className="rounded-2xl border border-red-100 bg-red-50 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                      onClick={() => void deleteSupplier(supplier)}
                      disabled={loading}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              ))}
              {filteredSuppliers.length === 0 ? (
                <div className="bg-white px-5 py-8 text-sm font-medium text-slate-600">
                  No suppliers match this search.
                </div>
              ) : null}
            </div>
          </div>
        </div>

        <aside className="space-y-5">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="soft-label">Quick Add</p>
            <h2 className="mt-2 text-xl font-black text-slate-950">Create supplier</h2>
            <div className="mt-4 grid gap-3">
              <input
                className="field bg-white"
                placeholder="Supplier name"
                value={form.name}
                onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
              />
              <input
                className="field bg-white"
                placeholder="Mobile"
                value={form.mobile}
                onChange={(e) => setForm((current) => ({ ...current, mobile: e.target.value }))}
              />
              <input
                className="field bg-white"
                placeholder="Address"
                value={form.address}
                onChange={(e) => setForm((current) => ({ ...current, address: e.target.value }))}
              />
              <button className="btn-secondary w-full" onClick={createSupplier} disabled={loading}>
                {loading ? "Processing..." : "Add Supplier"}
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5">
            <p className="soft-label">Supplier Payment / Advance</p>
            <h2 className="mt-2 text-xl font-black text-slate-950">Record cash out</h2>
            <p className="mt-1 text-sm font-semibold text-slate-500">
              Use this for payable settlement or advance paid before a purchase.
            </p>
            <div className="mt-4 grid gap-3">
              <select
                className="field"
                value={paymentForm.supplier_id}
                onChange={(e) =>
                  setPaymentForm((current) => ({ ...current, supplier_id: e.target.value }))
                }
              >
                <option value="">Select supplier</option>
                {suppliers.map((supplier) => (
                  <option key={supplier.id} value={supplier.id}>
                    {supplier.name} ({formatDualCurrency(supplier.balance ?? 0)})
                  </option>
                ))}
              </select>
              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  className="field"
                  placeholder="Payment / advance amount"
                  value={paymentForm.amount}
                  onChange={(e) =>
                    setPaymentForm((current) => ({ ...current, amount: e.target.value }))
                  }
                />
                <select
                  className="field"
                  value={paymentForm.mode}
                  onChange={(e) =>
                    setPaymentForm((current) => ({ ...current, mode: e.target.value }))
                  }
                >
                  <option value="cash">Cash</option>
                  <option value="bank">Bank</option>
                  <option value="knet">KNET</option>
                  <option value="other">Other</option>
                </select>
              </div>
              <input
                className="field"
                placeholder="Reference no."
                value={paymentForm.reference_no}
                onChange={(e) =>
                  setPaymentForm((current) => ({ ...current, reference_no: e.target.value }))
                }
              />
              <input
                className="field"
                placeholder="Note, for example advance before purchase"
                value={paymentForm.note}
                onChange={(e) =>
                  setPaymentForm((current) => ({ ...current, note: e.target.value }))
                }
              />
              <button
                className="btn-primary w-full"
                onClick={recordSupplierPayment}
                disabled={loading}
              >
                {loading ? "Processing..." : "Record Payment / Advance"}
              </button>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="soft-label">Recent Payments</p>
            <div className="mt-4 space-y-2">
              {payments.slice(0, 6).map((payment) => (
                <div key={payment.id} className="rounded-2xl bg-white p-4 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-black text-slate-950">
                        {supplierNameById.get(payment.supplier_id) ?? `Supplier #${payment.supplier_id}`}
                      </p>
                      <p className="mt-1 text-xs font-medium capitalize text-slate-500">
                        {payment.mode} {payment.reference_no ? `| ${payment.reference_no}` : ""}
                      </p>
                    </div>
                    <p className="shrink-0 font-black text-emerald-700">
                      <Money value={payment.amount} />
                    </p>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{new Date(payment.date).toLocaleString()}</p>
                </div>
              ))}
              {payments.length === 0 ? (
                <div className="rounded-2xl bg-white p-4 text-sm font-medium text-slate-600">
                  No supplier payments recorded yet.
                </div>
              ) : null}
            </div>
          </div>
        </aside>
      </div>
    </section>
    {statement ? (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-3 backdrop-blur-sm md:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="supplier-ledger-title"
      >
        <div className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] bg-white shadow-2xl">
          <div className="flex flex-col gap-4 border-b border-slate-100 p-5 md:flex-row md:items-start md:justify-between md:p-7">
            <div>
              <p className="soft-label">Supplier Ledger</p>
              <h2 id="supplier-ledger-title" className="mt-2 text-2xl font-black text-slate-950 md:text-3xl">
                {statement.supplier.name}
              </h2>
              <p className="mt-2 text-sm font-medium text-slate-500">
                Complete history of purchases, advances, payments, discounts, and invoice references.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 md:justify-end">
              <button
                type="button"
                className="rounded-2xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-900 transition hover:bg-slate-50"
                onClick={() => void downloadSupplierStatement(statement.supplier)}
              >
                Download PDF
              </button>
              <button
                type="button"
                className="rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white transition hover:bg-slate-800"
                onClick={() => setStatement(null)}
              >
                Close
              </button>
            </div>
          </div>

          <div className="overflow-y-auto p-5 md:p-7">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="soft-label">Purchased / Debit</p>
                <p className="mt-2 text-lg font-black text-slate-950">
                  <Money value={statement.totals.charges} />
                </p>
              </div>
              <div className="rounded-2xl bg-emerald-50 p-4">
                <p className="soft-label">Advance / Credit</p>
                <p className="mt-2 text-lg font-black text-emerald-700">
                  <Money value={statement.totals.payments} />
                </p>
              </div>
              <div className="rounded-2xl bg-amber-50 p-4">
                <p className="soft-label">Discounts</p>
                <p className="mt-2 text-lg font-black text-amber-700">
                  <Money value={statement.totals.discounts} />
                </p>
              </div>
              <div className="rounded-2xl bg-red-50 p-4">
                <p className="soft-label">Closing Balance</p>
                <p className="mt-2 text-lg font-black text-red-700">
                  <Money value={statement.totals.closing_balance} />
                </p>
              </div>
            </div>

            <div className="mt-5 space-y-3">
              {statement.rows.map((row) => (
                <div key={row.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${
                            row.type === "purchase"
                              ? "bg-red-50 text-red-700"
                              : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {row.type === "purchase" ? "Purchase" : "Payment"}
                        </span>
                        <span className="text-sm font-bold text-slate-500">{formatDate(row.date)}</span>
                      </div>
                      <p className="mt-3 text-base font-black text-slate-950">{row.description}</p>
                      <div className="mt-2 grid gap-1 text-sm text-slate-600 sm:grid-cols-2">
                        <span>Invoice / Ref: {row.reference || "-"}</span>
                        {row.type === "purchase" ? (
                          <>
                            <span>Purchase date: {formatDate(row.purchase_date || row.date)}</span>
                            <span>Goods received: {formatDate(row.goods_received_date)}</span>
                            <span>Weight: {Number(row.weight ?? 0).toFixed(3)} kg</span>
                            <span>Entered currency: {row.transaction_currency}</span>
                          </>
                        ) : null}
                      </div>
                    </div>

                    <div className="grid min-w-[260px] gap-2 text-sm">
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-slate-500">Debit / Purchased</span>
                        <span className="font-black text-red-700">
                          {row.charge ? <Money value={row.charge} /> : "-"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-4">
                        <span className="text-slate-500">Credit / Advance</span>
                        <span className="font-black text-emerald-700">
                          {row.payment ? <Money value={row.payment} /> : "-"}
                        </span>
                      </div>
                      {row.discount_amount ? (
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-500">Discount</span>
                          <span className="font-black text-amber-700">
                            <Money value={row.discount_amount} />
                          </span>
                        </div>
                      ) : null}
                      <div className="flex items-center justify-between gap-4 border-t border-slate-100 pt-2">
                        <span className="font-bold text-slate-600">Running balance</span>
                        <span className="font-black text-slate-950">
                          <Money value={row.balance} />
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {statement.rows.length === 0 ? (
                <div className="rounded-2xl bg-slate-50 px-4 py-5 text-sm font-medium text-slate-600">
                  No purchases or payments recorded for this supplier.
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    ) : null}
    </>
  );
}
