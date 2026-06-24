"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  downloadAuthenticatedFile,
  fetchJson,
  fetchJsonOrThrow,
  getAuthUser,
} from "../../lib/auth";
import { Money, useDisplayCurrency } from "../../lib/currency";

type Customer = {
  id: number;
  name: string;
};

type Invoice = {
  id: number;
  invoice_number?: string;
  customer_id: number;
  date: string;
  total: number;
  previous_balance: number;
  grand_total: number;
  type: string;
  paid_amount?: number;
  outstanding_amount?: number;
  payment_status?: "paid" | "partial" | "unpaid";
  payment_count?: number;
  status?: "active" | "void";
  void_reason?: string | null;
  voided_at?: string | null;
  delivery_receipt_original_name?: string | null;
  delivery_receipt_uploaded_at?: string | null;
};

export default function InvoicesPage() {
  const router = useRouter();
  const isAdmin = getAuthUser()?.role === "admin";
  const displayCurrency = useDisplayCurrency();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [status, setStatus] = useState("");
  const [loadingInvoiceId, setLoadingInvoiceId] = useState<number | null>(null);
  const [uploadingReceiptId, setUploadingReceiptId] = useState<number | null>(null);
  const [combinedCustomerId, setCombinedCustomerId] = useState("");
  const [combinedPeriod, setCombinedPeriod] = useState<"daily" | "weekly">("daily");
  const [combinedDate, setCombinedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [combinedCurrency, setCombinedCurrency] = useState<"KWD" | "USD">(displayCurrency);
  const [combinedPaymentStatus, setCombinedPaymentStatus] = useState<
    "outstanding" | "paid" | "all"
  >("outstanding");

  const loadInvoices = async () => {
    const data = await fetchJson<Invoice[]>("/invoices");
    setInvoices(Array.isArray(data) ? data : []);
  };

  useEffect(() => {
    fetchJson<Invoice[]>("/invoices")
      .then((data) => setInvoices(Array.isArray(data) ? data : []))
      .catch((error: Error) => setStatus(error.message || "Could not load invoices."));
    fetchJson<Customer[]>("/customers")
      .then((data) => setCustomers(Array.isArray(data) ? data : []))
      .catch((error: Error) => setStatus(error.message || "Could not load customers."));
  }, []);

  const customerNameById = new Map(customers.map((customer) => [customer.id, customer.name]));
  const sortedInvoices = [...invoices].sort((a, b) => b.id - a.id);

  useEffect(() => {
    if (!combinedCustomerId && customers.length > 0) {
      setCombinedCustomerId(String(customers[0].id));
    }
  }, [combinedCustomerId, customers]);

  const downloadCombinedInvoice = async () => {
    if (!combinedCustomerId) {
      setStatus("Choose a customer before downloading a combined invoice.");
      return;
    }

    const customerName =
      customerNameById.get(Number(combinedCustomerId)) ?? `customer-${combinedCustomerId}`;
    const fileName = `${combinedPeriod}-${combinedPaymentStatus}-${customerName}-${combinedDate}-${combinedCurrency}.pdf`
      .replace(/[^a-z0-9._-]+/gi, "-")
      .toLowerCase();

    setStatus("");

    try {
      await downloadAuthenticatedFile(
        `/invoices/consolidated/pdf?customer_id=${combinedCustomerId}&period=${combinedPeriod}&date=${combinedDate}&currency=${combinedCurrency}&payment_status=${combinedPaymentStatus}`,
        fileName
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not download combined invoice.";
      setStatus(message);
      alert(message);
    }
  };

  const voidInvoice = async (invoice: Invoice) => {
    const displayNumber = invoice.invoice_number ?? `#${invoice.id}`;
    const reason = window.prompt(`Reason for voiding invoice ${displayNumber}`);

    if (reason === null) {
      return;
    }

    setLoadingInvoiceId(invoice.id);
    setStatus("");

    try {
      await fetchJsonOrThrow(`/invoices/${invoice.id}/void`, {
        method: "POST",
        body: JSON.stringify({ reason: reason.trim() || undefined }),
      });
      setStatus(`Invoice ${displayNumber} voided successfully.`);
      await loadInvoices();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not void invoice.");
    } finally {
      setLoadingInvoiceId(null);
    }
  };

  const uploadDeliveryReceipt = async (invoice: Invoice, file?: File) => {
    if (!file) {
      return;
    }

    const formData = new FormData();
    formData.append("receipt", file);
    setUploadingReceiptId(invoice.id);
    setStatus("");

    try {
      await fetchJsonOrThrow(`/invoices/${invoice.id}/delivery-receipt`, {
        method: "POST",
        body: formData,
      });
      setStatus(
        `Delivery receipt uploaded for invoice ${invoice.invoice_number ?? `#${invoice.id}`}.`
      );
      await loadInvoices();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not upload delivery receipt.");
    } finally {
      setUploadingReceiptId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="panel p-6 md:p-8">
        <p className="soft-label">Invoice History</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
          Review past invoices
        </h1>
        <p className="mt-2 text-base leading-7 text-slate-600">
          Open previous bills, confirm totals, and download PDFs whenever needed.
        </p>
      </section>

      <section className="panel p-6 md:p-8">
        {status ? (
          <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {status}
          </div>
        ) : null}

        <div className="mb-6 rounded-3xl border border-slate-100 bg-slate-50 p-4 md:p-5">
          <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-center">
            <div className="min-w-0">
              <p className="soft-label">Combined Invoice</p>
              <h2 className="mt-1 text-xl font-bold text-slate-950">
                Daily or weekly customer bill
              </h2>
              <p className="mt-1 max-w-3xl text-sm font-medium leading-6 text-slate-600">
                Combine that customer's invoices into one PDF without changing the original invoices.
              </p>
            </div>
            <button
              type="button"
              className="btn-primary w-full whitespace-nowrap text-sm sm:w-auto"
              onClick={() => void downloadCombinedInvoice()}
            >
              Download Combined PDF
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <label className="block rounded-2xl border border-slate-200 bg-white p-3">
              <span className="soft-label">Customer</span>
              <select
                className="field mt-2 h-12 border-slate-200 bg-white px-3 py-2 text-base font-semibold text-slate-950 shadow-none"
                value={combinedCustomerId}
                onChange={(event) => setCombinedCustomerId(event.target.value)}
              >
                {customers.map((customer) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block rounded-2xl border border-slate-200 bg-white p-3">
              <span className="soft-label">Period</span>
              <select
                className="field mt-2 h-12 border-slate-200 bg-white px-3 py-2 text-base font-semibold text-slate-950 shadow-none"
                value={combinedPeriod}
                onChange={(event) => setCombinedPeriod(event.target.value === "weekly" ? "weekly" : "daily")}
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
              </select>
            </label>
            <label className="block rounded-2xl border border-slate-200 bg-white p-3">
              <span className="soft-label">Date</span>
              <input
                className="field mt-2 h-12 border-slate-200 bg-white px-3 py-2 text-base font-semibold text-slate-950 shadow-none"
                type="date"
                value={combinedDate}
                onChange={(event) => setCombinedDate(event.target.value)}
              />
            </label>
            <label className="block rounded-2xl border border-slate-200 bg-white p-3">
              <span className="soft-label">Currency</span>
              <select
                className="field mt-2 h-12 border-slate-200 bg-white px-3 py-2 text-base font-semibold text-slate-950 shadow-none"
                value={combinedCurrency}
                onChange={(event) => setCombinedCurrency(event.target.value === "USD" ? "USD" : "KWD")}
              >
                <option value="KWD">KWD invoices</option>
                <option value="USD">USD invoices</option>
              </select>
            </label>
            <label className="block rounded-2xl border border-slate-200 bg-white p-3 md:col-span-2 xl:col-span-1">
              <span className="soft-label">Bill Status</span>
              <select
                className="field mt-2 h-12 border-slate-200 bg-white px-3 py-2 text-base font-semibold text-slate-950 shadow-none"
                value={combinedPaymentStatus}
                onChange={(event) => {
                  const value = event.target.value;
                  setCombinedPaymentStatus(
                    value === "paid" ? "paid" : value === "all" ? "all" : "outstanding"
                  );
                }}
              >
                <option value="outstanding">Outstanding only</option>
                <option value="paid">Paid only</option>
                <option value="all">All active invoices</option>
              </select>
            </label>
          </div>
        </div>

        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-xl font-bold text-slate-950">All Invoices</h2>
          <div className="status-pill bg-black/5 text-slate-700">
            {sortedInvoices.length} invoice{sortedInvoices.length === 1 ? "" : "s"}
          </div>
        </div>

        <div className="space-y-3">
          {sortedInvoices.length === 0 ? (
            <div className="rounded-3xl bg-slate-50 px-5 py-6 text-sm font-medium text-slate-600">
              No invoices found yet.
            </div>
          ) : null}

          {sortedInvoices.map((invoice) => (
            <div
              key={invoice.id}
              className={`rounded-3xl border px-5 py-4 ${
                invoice.status === "void"
                  ? "border-slate-200 bg-slate-50 opacity-80"
                  : "border-black/8 bg-white"
              }`}
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-lg font-bold text-slate-950">
                    {invoice.invoice_number ?? `Invoice #${invoice.id}`}
                  </p>
                  {invoice.status === "void" ? (
                    <p className="mt-1 text-sm font-bold text-slate-500">Voided</p>
                  ) : null}
                  <p className="mt-1 text-sm text-slate-600">
                    {customerNameById.get(invoice.customer_id) || `Customer #${invoice.customer_id}`}
                  </p>
                  <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                    {new Date(invoice.date).toLocaleString()}
                  </p>
                  {invoice.void_reason ? (
                    <p className="mt-1 text-xs text-slate-500">
                      Reason: {invoice.void_reason}
                    </p>
                  ) : null}
                </div>

                <div className="grid gap-3 text-sm md:grid-cols-4 md:text-right">
                  <div>
                    <p className="soft-label">Total</p>
                    <p className="mt-1 text-lg font-bold text-slate-950">
                      <Money value={invoice.total} />
                    </p>
                  </div>
                  <div>
                    <p className="soft-label">Previous</p>
                    <p className="mt-1 text-lg font-bold text-slate-950">
                      <Money value={invoice.previous_balance} />
                    </p>
                  </div>
                  <div>
                    <p className="soft-label">Grand Total</p>
                    <p className="mt-1 text-lg font-black text-red-600">
                      <Money value={invoice.grand_total} />
                    </p>
                  </div>
                  <div>
                    <p className="soft-label">Status</p>
                    <span
                      className={[
                        "status-pill mt-1 capitalize",
                        invoice.payment_status === "paid"
                          ? "bg-emerald-100 text-emerald-700"
                          : invoice.payment_status === "partial"
                            ? "bg-amber-100 text-amber-700"
                            : invoice.status === "void"
                              ? "bg-slate-200 text-slate-700"
                              : "bg-red-100 text-red-700",
                      ].join(" ")}
                    >
                      {invoice.status === "void" ? "void" : invoice.payment_status ?? "unpaid"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm sm:grid-cols-3">
                <div>
                  <p className="soft-label">Paid</p>
                  <p className="mt-1 font-black text-emerald-700">
                    <Money value={invoice.paid_amount ?? 0} />
                  </p>
                </div>
                <div>
                  <p className="soft-label">Invoice Due</p>
                  <p className="mt-1 font-black text-red-700">
                    <Money value={invoice.outstanding_amount ?? invoice.total} />
                  </p>
                </div>
                <div>
                  <p className="soft-label">Payments</p>
                  <p className="mt-1 font-black text-slate-950">
                    {invoice.payment_count ?? 0}
                  </p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="soft-label">Delivery Receipt</p>
                    <p className="mt-1 text-sm font-semibold text-slate-700">
                      {invoice.delivery_receipt_original_name
                        ? invoice.delivery_receipt_original_name
                        : "No delivery receipt uploaded"}
                    </p>
                    {invoice.delivery_receipt_uploaded_at ? (
                      <p className="mt-1 text-xs font-semibold text-slate-400">
                        Uploaded {new Date(invoice.delivery_receipt_uploaded_at).toLocaleString()}
                      </p>
                    ) : null}
                  </div>

                  <div className="flex flex-wrap gap-3">
                    {invoice.status !== "void" ? (
                      <label className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                        {uploadingReceiptId === invoice.id ? "Uploading..." : "Upload Receipt"}
                        <input
                          type="file"
                          className="hidden"
                          accept="application/pdf,image/jpeg,image/png,image/webp"
                          disabled={uploadingReceiptId === invoice.id}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.currentTarget.value = "";
                            void uploadDeliveryReceipt(invoice, file);
                          }}
                        />
                      </label>
                    ) : null}

                    {invoice.delivery_receipt_original_name ? (
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() =>
                          void downloadAuthenticatedFile(
                            `/invoices/${invoice.id}/delivery-receipt`,
                            invoice.delivery_receipt_original_name ??
                              `invoice-${invoice.id}-delivery-receipt`
                          ).catch((error: Error) => {
                            setStatus(error.message || "Could not download delivery receipt.");
                            alert(error.message || "Something went wrong");
                          })
                        }
                      >
                        Download Receipt
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-3">
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() =>
                    void downloadAuthenticatedFile(
                      `/invoices/${invoice.id}/pdf`,
                      `${invoice.invoice_number ?? `invoice-${invoice.id}`}.pdf`
                    ).catch((error: Error) => {
                      setStatus(error.message || "Could not download invoice PDF.");
                      alert(error.message || "Something went wrong");
                    })
                  }
                >
                  Download PDF
                </button>
                <button
                  type="button"
                  onClick={() => router.push(`/statement?customer=${invoice.customer_id}`)}
                  className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700 transition hover:bg-red-100"
                >
                  View Statement
                </button>
                {isAdmin && invoice.status !== "void" && invoice.payment_status === "unpaid" ? (
                  <button
                    type="button"
                    className="rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                    onClick={() => void voidInvoice(invoice)}
                    disabled={loadingInvoiceId === invoice.id}
                  >
                    {loadingInvoiceId === invoice.id ? "Voiding..." : "Void Invoice"}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
