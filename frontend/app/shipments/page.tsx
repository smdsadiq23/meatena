"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { fetchJson, fetchJsonOrThrow } from "../../lib/auth";
import { Money } from "../../lib/currency";

type ShipmentStatus = "open" | "closed";

type ShipmentRecord = {
  id: number;
  shipment_id?: number | null;
  date: string;
  total?: number | string;
  amount?: number | string;
  invoice_no?: string | null;
  invoice_number?: string | null;
  title?: string;
  category?: string;
  type?: string;
  status?: string;
  transaction_currency?: "KWD" | "USD";
};

type ShipmentSummary = {
  id: number;
  name: string;
  reference_no?: string | null;
  arrival_date?: string | null;
  status: ShipmentStatus;
  purchase_amount: number;
  sales_amount: number;
  expenses_amount: number;
  profit: number;
  purchase_count: number;
  invoice_count: number;
  expense_count: number;
  purchases: ShipmentRecord[];
  invoices: ShipmentRecord[];
  expenses: ShipmentRecord[];
};

type ShipmentForm = {
  name: string;
  referenceNo: string;
  arrivalDate: string;
};

type LinkPayload = {
  purchase_ids?: number[];
  invoice_ids?: number[];
  expense_ids?: number[];
  unlink?: boolean;
};

const emptyShipmentForm: ShipmentForm = {
  name: "",
  referenceNo: "",
  arrivalDate: "",
};

function formatDate(value?: string | null) {
  if (!value) {
    return "No date";
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString();
}

function recordTitle(record: ShipmentRecord, fallback: string) {
  return (
    record.invoice_no ||
    record.invoice_number ||
    record.title ||
    `${fallback} #${record.id}`
  );
}

function recordValue(record: ShipmentRecord) {
  return Number(record.total ?? record.amount ?? 0);
}

function toggleId(ids: number[], id: number) {
  return ids.includes(id) ? ids.filter((item) => item !== id) : [...ids, id];
}

function SelectableRecord({
  checked,
  record,
  title,
  meta,
  onToggle,
}: {
  checked: boolean;
  record: ShipmentRecord;
  title: string;
  meta: string;
  onToggle: () => void;
}) {
  return (
    <label
      className={[
        "flex cursor-pointer items-center gap-3 rounded-2xl border px-4 py-3 transition",
        checked
          ? "border-primary/35 bg-red-50 text-slate-950"
          : "border-slate-200 bg-white hover:border-slate-300",
      ].join(" ")}
    >
      <input
        type="checkbox"
        className="h-5 w-5 accent-primary"
        checked={checked}
        onChange={onToggle}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-black text-slate-950">{title}</span>
        <span className="mt-0.5 block truncate text-xs font-semibold text-slate-500">
          {meta}
        </span>
      </span>
      <span className="text-right text-sm font-black text-slate-950">
        <Money value={recordValue(record)} />
      </span>
    </label>
  );
}

export default function ShipmentsPage() {
  const [shipments, setShipments] = useState<ShipmentSummary[]>([]);
  const [purchases, setPurchases] = useState<ShipmentRecord[]>([]);
  const [invoices, setInvoices] = useState<ShipmentRecord[]>([]);
  const [expenses, setExpenses] = useState<ShipmentRecord[]>([]);
  const [selectedShipmentId, setSelectedShipmentId] = useState("");
  const [form, setForm] = useState<ShipmentForm>(emptyShipmentForm);
  const [selectedPurchaseIds, setSelectedPurchaseIds] = useState<number[]>([]);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<number[]>([]);
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<number[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState<"success" | "error">("success");

  const selectedShipment = useMemo(
    () => shipments.find((shipment) => String(shipment.id) === selectedShipmentId) ?? shipments[0],
    [selectedShipmentId, shipments]
  );

  const availablePurchases = useMemo(
    () =>
      purchases.filter(
        (purchase) => !purchase.shipment_id || purchase.shipment_id === selectedShipment?.id
      ),
    [purchases, selectedShipment?.id]
  );
  const availableInvoices = useMemo(
    () =>
      invoices.filter(
        (invoice) =>
          invoice.status !== "void" &&
          (!invoice.shipment_id || invoice.shipment_id === selectedShipment?.id)
      ),
    [invoices, selectedShipment?.id]
  );
  const availableExpenses = useMemo(
    () =>
      expenses.filter(
        (expense) => !expense.shipment_id || expense.shipment_id === selectedShipment?.id
      ),
    [expenses, selectedShipment?.id]
  );

  const linkedActivity = selectedShipment
    ? [
        ...selectedShipment.purchases.map((record) => ({
          ...record,
          group: "Purchase",
          key: `purchase-${record.id}`,
        })),
        ...selectedShipment.invoices.map((record) => ({
          ...record,
          group: "Sale",
          key: `invoice-${record.id}`,
        })),
        ...selectedShipment.expenses.map((record) => ({
          ...record,
          group: "Expense",
          key: `expense-${record.id}`,
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    : [];

  async function load(preserveStatus = false) {
    if (!preserveStatus) {
      setStatus("");
    }

    try {
      const [shipmentData, purchaseData, invoiceData, expenseData] = await Promise.all([
        fetchJson<ShipmentSummary[]>("/shipments/summary"),
        fetchJson<ShipmentRecord[]>("/purchases"),
        fetchJson<ShipmentRecord[]>("/invoices"),
        fetchJson<ShipmentRecord[]>("/expenses"),
      ]);

      setShipments(Array.isArray(shipmentData) ? shipmentData : []);
      setPurchases(Array.isArray(purchaseData) ? purchaseData : []);
      setInvoices(Array.isArray(invoiceData) ? invoiceData : []);
      setExpenses(Array.isArray(expenseData) ? expenseData : []);
      setSelectedShipmentId((current) => {
        if (current && shipmentData.some((shipment) => String(shipment.id) === current)) {
          return current;
        }

        return shipmentData[0] ? String(shipmentData[0].id) : "";
      });
    } catch (error) {
      setStatusType("error");
      setStatus(error instanceof Error ? error.message : "Could not load shipments.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    if (!selectedShipment) {
      setSelectedPurchaseIds([]);
      setSelectedInvoiceIds([]);
      setSelectedExpenseIds([]);
      return;
    }

    setSelectedPurchaseIds(selectedShipment.purchases.map((record) => record.id));
    setSelectedInvoiceIds(selectedShipment.invoices.map((record) => record.id));
    setSelectedExpenseIds(selectedShipment.expenses.map((record) => record.id));
  }, [selectedShipment?.id]);

  async function createShipment() {
    if (!form.name.trim()) {
      setStatusType("error");
      setStatus("Enter a shipment name.");
      return;
    }

    setSaving(true);
    setStatus("");

    try {
      const created = await fetchJsonOrThrow<ShipmentSummary>("/shipments", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          reference_no: form.referenceNo.trim() || undefined,
          arrival_date: form.arrivalDate || undefined,
        }),
      });

      setForm(emptyShipmentForm);
      setSelectedShipmentId(String(created.id));
      setStatusType("success");
      setStatus("Shipment created. Now tick the records that belong to it.");
      await load(true);
    } catch (error) {
      setStatusType("error");
      setStatus(error instanceof Error ? error.message : "Could not create shipment.");
    } finally {
      setSaving(false);
    }
  }

  async function saveLinks() {
    if (!selectedShipment) {
      setStatusType("error");
      setStatus("Create or select a shipment first.");
      return;
    }

    const currentPurchaseIds = selectedShipment.purchases.map((record) => record.id);
    const currentInvoiceIds = selectedShipment.invoices.map((record) => record.id);
    const currentExpenseIds = selectedShipment.expenses.map((record) => record.id);
    const removedPurchaseIds = currentPurchaseIds.filter((id) => !selectedPurchaseIds.includes(id));
    const removedInvoiceIds = currentInvoiceIds.filter((id) => !selectedInvoiceIds.includes(id));
    const removedExpenseIds = currentExpenseIds.filter((id) => !selectedExpenseIds.includes(id));
    const linkPayload: LinkPayload = {
      purchase_ids: selectedPurchaseIds,
      invoice_ids: selectedInvoiceIds,
      expense_ids: selectedExpenseIds,
    };
    const unlinkPayload: LinkPayload = {
      unlink: true,
      purchase_ids: removedPurchaseIds,
      invoice_ids: removedInvoiceIds,
      expense_ids: removedExpenseIds,
    };
    const hasLinks =
      selectedPurchaseIds.length + selectedInvoiceIds.length + selectedExpenseIds.length > 0;
    const hasUnlinks =
      removedPurchaseIds.length + removedInvoiceIds.length + removedExpenseIds.length > 0;

    if (!hasLinks && !hasUnlinks) {
      setStatusType("success");
      setStatus("No shipment link changes to save.");
      return;
    }

    setSaving(true);
    setStatus("");

    try {
      if (hasLinks) {
        await fetchJsonOrThrow(`/shipments/${selectedShipment.id}/links`, {
          method: "PATCH",
          body: JSON.stringify(linkPayload),
        });
      }

      if (hasUnlinks) {
        await fetchJsonOrThrow(`/shipments/${selectedShipment.id}/links`, {
          method: "PATCH",
          body: JSON.stringify(unlinkPayload),
        });
      }

      setStatusType("success");
      setStatus("Shipment links saved.");
      await load(true);
    } catch (error) {
      setStatusType("error");
      setStatus(error instanceof Error ? error.message : "Could not save shipment links.");
    } finally {
      setSaving(false);
    }
  }

  async function unlinkRecord(record: ShipmentRecord & { group: string }) {
    if (!selectedShipment) {
      return;
    }

    const payload: LinkPayload = { unlink: true };
    if (record.group === "Purchase") {
      payload.purchase_ids = [record.id];
    } else if (record.group === "Sale") {
      payload.invoice_ids = [record.id];
    } else {
      payload.expense_ids = [record.id];
    }

    setSaving(true);
    setStatus("");

    try {
      await fetchJsonOrThrow(`/shipments/${selectedShipment.id}/links`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });
      setStatusType("success");
      setStatus(`${record.group} unlinked from shipment.`);
      await load(true);
    } catch (error) {
      setStatusType("error");
      setStatus(error instanceof Error ? error.message : "Could not unlink record.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className="panel p-6 md:p-8">
        <div className="grid gap-6 xl:grid-cols-[1fr_420px] xl:items-start">
          <div>
            <p className="soft-label">Shipment Workspace</p>
            <h1 className="mt-2 max-w-3xl text-3xl font-black tracking-tight text-slate-950">
              Profit by shipment, without hunting through reports
            </h1>
            <p className="mt-3 max-w-3xl text-base leading-7 text-slate-600">
              Create one shipment, link its purchases, sales invoices, and expenses,
              then review the exact profit in one place.
            </p>

            <div className="mt-6 grid gap-3 md:grid-cols-4">
              <div className="rounded-3xl bg-slate-50 p-4">
                <p className="soft-label">Formula</p>
                <p className="mt-2 text-sm font-black text-slate-950">
                  Purchase + Expenses = Cost
                </p>
              </div>
              <div className="rounded-3xl bg-emerald-50 p-4">
                <p className="soft-label text-emerald-700">Sales</p>
                <p className="mt-2 text-sm font-black text-emerald-800">
                  Customer invoices
                </p>
              </div>
              <div className="rounded-3xl bg-amber-50 p-4">
                <p className="soft-label text-amber-700">Profit</p>
                <p className="mt-2 text-sm font-black text-amber-800">
                  Sales - Cost
                </p>
              </div>
              <div className="rounded-3xl bg-red-50 p-4">
                <p className="soft-label text-red-700">Rule</p>
                <p className="mt-2 text-sm font-black text-red-700">
                  Link once, update anytime
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
            <h2 className="text-xl font-black text-slate-950">New shipment</h2>
            <div className="mt-4 grid gap-3">
              <input
                className="field"
                placeholder="Shipment name"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
              <input
                className="field"
                placeholder="Reference no."
                value={form.referenceNo}
                onChange={(event) =>
                  setForm((current) => ({ ...current, referenceNo: event.target.value }))
                }
              />
              <input
                className="field"
                type="date"
                value={form.arrivalDate}
                onChange={(event) =>
                  setForm((current) => ({ ...current, arrivalDate: event.target.value }))
                }
              />
              <button className="btn-primary" disabled={saving} onClick={createShipment}>
                Create Shipment
              </button>
            </div>
          </div>
        </div>
      </section>

      {status ? (
        <div
          className={[
            "rounded-3xl border px-5 py-4 text-sm font-bold",
            statusType === "error"
              ? "border-red-100 bg-red-50 text-red-700"
              : "border-emerald-100 bg-emerald-50 text-emerald-700",
          ].join(" ")}
        >
          {status}
        </div>
      ) : null}

      <section className="grid gap-5 xl:grid-cols-[360px_1fr]">
        <div className="panel p-5 md:p-6">
          <p className="soft-label">Step 1</p>
          <h2 className="mt-2 text-2xl font-black text-slate-950">
            Select shipment
          </h2>

          {loading ? (
            <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-6 text-sm font-semibold text-slate-600">
              Loading shipments...
            </div>
          ) : shipments.length ? (
            <div className="mt-5 space-y-3">
              {shipments.map((shipment) => {
                const active = selectedShipment?.id === shipment.id;

                return (
                  <button
                    key={shipment.id}
                    type="button"
                    className={[
                      "w-full rounded-3xl border p-4 text-left transition",
                      active
                        ? "border-primary/40 bg-red-50"
                        : "border-slate-200 bg-white hover:border-slate-300",
                    ].join(" ")}
                    onClick={() => setSelectedShipmentId(String(shipment.id))}
                  >
                    <span className="block text-base font-black text-slate-950">
                      {shipment.name}
                    </span>
                    <span className="mt-1 block text-xs font-semibold text-slate-500">
                      {shipment.reference_no || "No reference"} · {formatDate(shipment.arrival_date)}
                    </span>
                    <span className="mt-3 inline-flex rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-slate-600">
                      {shipment.purchase_count} purchases · {shipment.invoice_count} sales · {shipment.expense_count} expenses
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl bg-slate-50 px-4 py-6 text-sm font-semibold text-slate-600">
              Create the first shipment to begin.
            </div>
          )}
        </div>

        <div className="space-y-5">
          <div className="panel p-5 md:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="soft-label">Step 2</p>
                <h2 className="mt-2 text-2xl font-black text-slate-950">
                  Tick records for this shipment
                </h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">
                  Existing records can be linked here. This does not change invoice or purchase amounts.
                </p>
              </div>
              <button
                className="btn-primary min-w-[180px]"
                disabled={saving || !selectedShipment}
                onClick={saveLinks}
              >
                Save Links
              </button>
            </div>

            <div className="mt-5 grid gap-4 xl:grid-cols-3">
              <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="soft-label">Purchases</p>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600">
                    {selectedPurchaseIds.length}
                  </span>
                </div>
                <div className="grid max-h-[360px] gap-2 overflow-y-auto pr-1">
                  {availablePurchases.length ? (
                    availablePurchases.map((purchase) => (
                      <SelectableRecord
                        key={purchase.id}
                        checked={selectedPurchaseIds.includes(purchase.id)}
                        record={purchase}
                        title={recordTitle(purchase, "Purchase")}
                        meta={`${formatDate(purchase.date)} · ${purchase.transaction_currency ?? "KWD"}`}
                        onToggle={() =>
                          setSelectedPurchaseIds((current) => toggleId(current, purchase.id))
                        }
                      />
                    ))
                  ) : (
                    <p className="rounded-2xl bg-white px-4 py-5 text-sm font-semibold text-slate-500">
                      No unlinked purchases.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="soft-label">Sales invoices</p>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600">
                    {selectedInvoiceIds.length}
                  </span>
                </div>
                <div className="grid max-h-[360px] gap-2 overflow-y-auto pr-1">
                  {availableInvoices.length ? (
                    availableInvoices.map((invoice) => (
                      <SelectableRecord
                        key={invoice.id}
                        checked={selectedInvoiceIds.includes(invoice.id)}
                        record={invoice}
                        title={recordTitle(invoice, "Invoice")}
                        meta={`${formatDate(invoice.date)} · ${invoice.type ?? "sale"} · ${invoice.transaction_currency ?? "KWD"}`}
                        onToggle={() =>
                          setSelectedInvoiceIds((current) => toggleId(current, invoice.id))
                        }
                      />
                    ))
                  ) : (
                    <p className="rounded-2xl bg-white px-4 py-5 text-sm font-semibold text-slate-500">
                      No unlinked sales invoices.
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-[28px] border border-slate-200 bg-slate-50 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="soft-label">Expenses</p>
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-slate-600">
                    {selectedExpenseIds.length}
                  </span>
                </div>
                <div className="grid max-h-[360px] gap-2 overflow-y-auto pr-1">
                  {availableExpenses.length ? (
                    availableExpenses.map((expense) => (
                      <SelectableRecord
                        key={expense.id}
                        checked={selectedExpenseIds.includes(expense.id)}
                        record={expense}
                        title={recordTitle(expense, "Expense")}
                        meta={`${formatDate(expense.date)} · ${expense.category ?? "expense"}`}
                        onToggle={() =>
                          setSelectedExpenseIds((current) => toggleId(current, expense.id))
                        }
                      />
                    ))
                  ) : (
                    <p className="rounded-2xl bg-white px-4 py-5 text-sm font-semibold text-slate-500">
                      No unlinked expenses.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {selectedShipment ? (
            <div className="panel p-5 md:p-6">
              <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="soft-label">Step 3</p>
                  <h2 className="mt-2 text-2xl font-black text-slate-950">
                    Profit summary
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">
                    {selectedShipment.name}
                  </p>
                </div>
                <Link className="btn-secondary" href="/reports">
                  Open Reports
                </Link>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="rounded-3xl bg-slate-50 p-5">
                  <p className="soft-label">Purchase amount</p>
                  <p className="mt-3 text-3xl font-black text-slate-950">
                    <Money value={selectedShipment.purchase_amount} />
                  </p>
                </div>
                <div className="rounded-3xl bg-red-50 p-5">
                  <p className="soft-label text-red-700">Expenses</p>
                  <p className="mt-3 text-3xl font-black text-red-700">
                    <Money value={selectedShipment.expenses_amount} />
                  </p>
                </div>
                <div className="rounded-3xl bg-emerald-50 p-5">
                  <p className="soft-label text-emerald-700">Sales amount</p>
                  <p className="mt-3 text-3xl font-black text-emerald-800">
                    <Money value={selectedShipment.sales_amount} />
                  </p>
                </div>
                <div className="rounded-3xl bg-amber-50 p-5">
                  <p className="soft-label text-amber-700">Profit</p>
                  <p
                    className={[
                      "mt-3 text-3xl font-black",
                      selectedShipment.profit >= 0 ? "text-amber-800" : "text-red-700",
                    ].join(" ")}
                  >
                    <Money value={selectedShipment.profit} />
                  </p>
                </div>
              </div>

              <div className="mt-5 rounded-[28px] border border-slate-200 p-4">
                <div className="flex flex-col gap-1 md:flex-row md:items-end md:justify-between">
                  <div>
                    <p className="soft-label">Linked history</p>
                    <h3 className="text-xl font-black text-slate-950">
                      Everything inside this shipment
                    </h3>
                  </div>
                  <p className="text-sm font-semibold text-slate-500">
                    Unlink mistakes without deleting original records.
                  </p>
                </div>

                <div className="mt-4 grid gap-3">
                  {linkedActivity.length ? (
                    linkedActivity.map((record) => (
                      <div
                        key={record.key}
                        className="grid gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm md:grid-cols-[110px_1fr_130px_140px_auto] md:items-center"
                      >
                        <span className="font-black text-slate-950">{record.group}</span>
                        <span className="font-semibold text-slate-700">
                          {recordTitle(record, record.group)}
                        </span>
                        <span className="text-slate-500">{formatDate(record.date)}</span>
                        <span className="font-black text-slate-950 md:text-right">
                          <Money value={recordValue(record)} />
                        </span>
                        <button
                          type="button"
                          className="rounded-full border border-red-100 bg-white px-4 py-2 text-xs font-black text-red-600 transition hover:bg-red-50"
                          disabled={saving}
                          onClick={() => unlinkRecord(record)}
                        >
                          Unlink
                        </button>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl bg-slate-50 px-4 py-6 text-sm font-semibold text-slate-600">
                      Nothing linked yet. Tick records above and save links.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
