"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchJson, fetchJsonOrThrow, getAuthUser } from "../../lib/auth";
import { formatDualCurrency, Money } from "../../lib/currency";

type Customer = {
  id: number;
  name: string;
  mobile?: string;
};

type Invoice = {
  id: number;
  invoice_number?: string | null;
  customer_id: number;
  date: string;
  total: number;
  grand_total: number;
  paid_amount?: number;
  outstanding_amount?: number;
  payment_status?: "paid" | "partial" | "unpaid";
  status?: "active" | "void";
};

type KnetLinkResponse = {
  url: string;
  invoiceId: number;
  invoiceIds?: number[];
  gatewayInvoiceId?: number;
  sessionId?: number;
};

type KnetAvailability = {
  configured: boolean;
  missingKeys: string[];
  mode?: "live" | "mock";
  message: string;
};

type PaymentRecord = {
  id: number;
  customer_id: number;
  invoice_id: number | null;
  amount: number;
  mode: "cash" | "knet" | "card";
  reference?: string | null;
  date: string;
  status?: "active" | "reversed";
  reversal_reason?: string | null;
  reversed_at?: string | null;
};

function normalizeWhatsAppNumber(value?: string | null) {
  const digits = (value ?? "").replace(/\D/g, "");

  if (!digits) {
    return "";
  }

  if (digits.length === 8) {
    return `965${digits}`;
  }

  return digits;
}

export default function Payment() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [payments, setPayments] = useState<PaymentRecord[]>([]);
  const [customerId, setCustomerId] = useState("");
  const [invoiceId, setInvoiceId] = useState("");
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<number[]>([]);
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState("");
  const [knetUrl, setKnetUrl] = useState("");
  const [onlineLinkKind, setOnlineLinkKind] = useState<"knet" | "card">("knet");
  const [knetAvailability, setKnetAvailability] = useState<KnetAvailability | null>(null);
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState<"success" | "error">("success");
  const [loading, setLoading] = useState(false);
  const [onlineLoading, setOnlineLoading] = useState<"knet" | "card" | null>(null);
  const [reversalLoadingId, setReversalLoadingId] = useState<number | null>(null);
  const isAdmin = getAuthUser()?.role === "admin";

  useEffect(() => {
    fetchJson<Customer[]>("/customers")
      .then((data) => setCustomers(Array.isArray(data) ? data : []))
      .catch((error: Error) => {
        setStatusType("error");
        setStatus(error.message || "Could not load customers.");
      });

    fetchJson<Invoice[]>("/invoices")
      .then((data) => setInvoices(Array.isArray(data) ? data : []))
      .catch((error: Error) => {
        setStatusType("error");
        setStatus(error.message || "Could not load invoices.");
      });

    fetchJson<PaymentRecord[]>("/payments")
      .then((data) => setPayments(Array.isArray(data) ? data : []))
      .catch((error: Error) => {
        setStatusType("error");
        setStatus(error.message || "Could not load payments.");
      });

    fetchJson<KnetAvailability>("/payments/knet/availability")
      .then(setKnetAvailability)
      .catch(() =>
        setKnetAvailability({
          configured: false,
          missingKeys: [],
          message: "Could not check KNET gateway availability.",
        })
      );
  }, []);

  useEffect(() => {
    if (!customerId) {
      return;
    }

    fetchJson<{ balance?: number }>(`/ledger/balance/${customerId}`)
      .then((data) => setBalance(Number(data.balance ?? 0)))
      .catch((error: Error) => {
        setStatusType("error");
        setStatus(error.message || "Could not load customer balance.");
      });
  }, [customerId]);

  const customerInvoices = useMemo(() => {
    if (!customerId) {
      return [];
    }

    return invoices
      .filter((invoice) => String(invoice.customer_id) === customerId)
      .filter((invoice) => invoice.status !== "void")
      .filter((invoice) => invoice.payment_status !== "paid")
      .sort((a, b) => b.id - a.id);
  }, [customerId, invoices]);

  const selectedInvoices = useMemo(
    () =>
      customerInvoices.filter((invoice) =>
        selectedInvoiceIds.includes(invoice.id)
      ),
    [customerInvoices, selectedInvoiceIds]
  );
  const selectedOnlineAmount = useMemo(
    () =>
      selectedInvoices.reduce(
        (sum, invoice) =>
          sum + Number(invoice.outstanding_amount ?? invoice.total),
        0
      ),
    [selectedInvoices]
  );

  const selectedCustomer = customers.find((customer) => String(customer.id) === customerId);
  const customerNameById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer.name])),
    [customers]
  );
  const recentPayments = useMemo(() => payments.slice(0, 12), [payments]);
  const selectedOnlineLabels = selectedInvoices.map(
    (invoice) => invoice.invoice_number ?? `Invoice #${invoice.id}`
  );

  const changeCustomer = (nextCustomerId: string) => {
    setCustomerId(nextCustomerId);
    setInvoiceId("");
    setSelectedInvoiceIds([]);
    setKnetUrl("");
    setBalance(0);
  };

  const toggleOnlineInvoice = (invoice: Invoice) => {
    setKnetUrl("");
    setSelectedInvoiceIds((current) => {
      const exists = current.includes(invoice.id);
      const nextIds = exists
        ? current.filter((id) => id !== invoice.id)
        : [...current, invoice.id];
      const nextInvoices = customerInvoices.filter((item) =>
        nextIds.includes(item.id)
      );
      const nextAmount = nextInvoices.reduce(
        (sum, item) => sum + Number(item.outstanding_amount ?? item.total),
        0
      );

      setAmount(nextIds.length ? nextAmount.toFixed(3) : "");

      return nextIds;
    });
  };

  const submitPayment = async () => {
    if (!customerId || !Number(amount)) {
      setStatusType("error");
      setStatus("Select a customer and enter a valid amount.");
      return;
    }

    if (!confirm("Are you sure you want to record this payment?")) {
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      await fetchJsonOrThrow("/payments", {
        method: "POST",
        body: JSON.stringify({
          customer_id: Number(customerId),
          invoice_id: invoiceId ? Number(invoiceId) : undefined,
          amount: Number(amount),
          mode: "cash",
        }),
      });

      setStatusType("success");
      setStatus("Payment recorded successfully.");
      setAmount("");
      setInvoiceId("");
      setKnetUrl("");

      const [data, invoiceData, paymentData] = await Promise.all([
        fetchJsonOrThrow<{ balance?: number }>(`/ledger/balance/${customerId}`),
        fetchJsonOrThrow<Invoice[]>("/invoices"),
        fetchJsonOrThrow<PaymentRecord[]>("/payments"),
      ]);
      setBalance(Number(data.balance ?? 0));
      setInvoices(Array.isArray(invoiceData) ? invoiceData : []);
      setPayments(Array.isArray(paymentData) ? paymentData : []);
      alert("✅ Payment recorded successfully");
    } catch (error) {
      setStatusType("error");
      setStatus(error instanceof Error ? error.message : "Payment could not be recorded.");
    } finally {
      setLoading(false);
    }
  };

  const createOnlinePaymentLink = async (kind: "knet" | "card") => {
    if (knetAvailability && !knetAvailability.configured) {
      setStatusType("error");
      setStatus(knetAvailability.message);
      return;
    }

    if (!selectedInvoices.length) {
      setStatusType("error");
      setStatus("Select one or more invoices before creating a payment link.");
      return;
    }

    setOnlineLoading(kind);
    setStatus("");
    setKnetUrl("");

    try {
      const payload = await fetchJsonOrThrow<KnetLinkResponse>(`/payments/${kind}`, {
        method: "POST",
        body: JSON.stringify({
          invoice_id: selectedInvoiceIds.length === 1 ? selectedInvoiceIds[0] : undefined,
          invoice_ids: selectedInvoiceIds,
          amount: Number(selectedOnlineAmount.toFixed(3)),
        }),
      });

      setKnetUrl(payload.url);
      setOnlineLinkKind(kind);
      setStatusType("success");
      setStatus(
        `${kind === "card" ? "Card" : "KNET"} link created for ${selectedInvoices.length} invoice${
          selectedInvoices.length === 1 ? "" : "s"
        }.`
      );
      window.open(payload.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setStatusType("error");
      setStatus(
        error instanceof Error
          ? error.message
          : `Could not create ${kind === "card" ? "card" : "KNET"} link.`
      );
    } finally {
      setOnlineLoading(null);
    }
  };

  const copyKnetLink = async () => {
    if (!knetUrl) {
      return;
    }

    try {
      await navigator.clipboard.writeText(knetUrl);
      setStatusType("success");
      setStatus("Payment link copied.");
    } catch {
      setStatusType("error");
      setStatus("Could not copy payment link.");
    }
  };

  const shareKnetViaWhatsApp = () => {
    if (!knetUrl || !selectedInvoices.length || !selectedCustomer) {
      setStatusType("error");
      setStatus("Create a payment link first, then share it on WhatsApp.");
      return;
    }

    const phone = normalizeWhatsAppNumber(selectedCustomer.mobile);
    const amountDue = formatDualCurrency(selectedOnlineAmount);
    const message = [
      `Hello ${selectedCustomer.name},`,
      `Please pay ${amountDue} for invoice${
        selectedInvoices.length === 1 ? "" : "s"
      } ${selectedOnlineLabels.join(", ")}.`,
      knetUrl,
      "Thank you.",
    ].join("\n");
    const whatsappUrl = phone
      ? `https://wa.me/${phone}?text=${encodeURIComponent(message)}`
      : `https://wa.me/?text=${encodeURIComponent(message)}`;

    window.open(whatsappUrl, "_blank", "noopener,noreferrer");
  };

  const reversePayment = async (payment: PaymentRecord) => {
    if (!isAdmin || payment.status === "reversed") {
      return;
    }

    const reason = prompt("Reason for reversing this payment?");
    if (reason === null) {
      return;
    }

    if (!confirm(`Reverse payment #${payment.id} for ${formatDualCurrency(payment.amount)}?`)) {
      return;
    }

    setReversalLoadingId(payment.id);
    setStatus("");

    try {
      const [result, invoiceData, paymentData] = await Promise.all([
        fetchJsonOrThrow<{ new_balance?: number }>(`/payments/${payment.id}/reverse`, {
          method: "POST",
          body: JSON.stringify({ reason: reason.trim() || undefined }),
        }),
        fetchJsonOrThrow<Invoice[]>("/invoices"),
        fetchJsonOrThrow<PaymentRecord[]>("/payments"),
      ]);

      setInvoices(Array.isArray(invoiceData) ? invoiceData : []);
      setPayments(Array.isArray(paymentData) ? paymentData : []);
      if (customerId && Number(customerId) === payment.customer_id) {
        setBalance(Number(result.new_balance ?? 0));
      }
      setStatusType("success");
      setStatus("Payment reversed. Ledger and invoice balance updated.");
    } catch (error) {
      setStatusType("error");
      setStatus(error instanceof Error ? error.message : "Could not reverse payment.");
    } finally {
      setReversalLoadingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <section className="panel p-6 md:p-8">
        <p className="soft-label">Collections</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
          Receive customer payment
        </h1>
      </section>

      {status ? (
        <div
          className={`rounded-2xl px-4 py-3 text-sm font-medium ${
            statusType === "error"
              ? "border border-red-100 bg-red-50 text-red-700"
              : "border border-emerald-100 bg-emerald-50 text-emerald-700"
          }`}
        >
          {status}
        </div>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <section className="panel p-6 md:p-8">
        <p className="soft-label">Cash Collection</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-950">Record cash payment</h2>

        <div className="mt-6 space-y-4">
          {knetAvailability && !knetAvailability.configured ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
              {knetAvailability.message}
            </div>
          ) : null}

          {knetAvailability?.mode === "mock" ? (
            <div className="rounded-2xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-medium text-blue-800">
              Online payment mock mode is active for local testing.
            </div>
          ) : null}

          <select
            className="field"
            onChange={(e) => changeCustomer(e.target.value)}
            value={customerId}
          >
            <option value="">Select customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name} {customer.mobile ? `(${customer.mobile})` : ""}
              </option>
            ))}
          </select>

          <input
            placeholder="Enter payment amount"
            value={amount}
            className="field"
            onChange={(e) => setAmount(e.target.value)}
          />

          <select
            className="field"
            value={invoiceId}
            onChange={(e) => {
              const nextInvoiceId = e.target.value;
              setInvoiceId(nextInvoiceId);
              const invoice = customerInvoices.find(
                (item) => String(item.id) === nextInvoiceId
              );
              if (invoice) {
                setAmount(String(Number(invoice.outstanding_amount ?? invoice.total).toFixed(3)));
              }
            }}
            disabled={!customerId}
          >
            <option value="">General collection</option>
            {customerInvoices.map((invoice) => (
              <option key={invoice.id} value={invoice.id}>
                {invoice.invoice_number ?? `Invoice #${invoice.id}`} - Due{" "}
                {formatDualCurrency(invoice.outstanding_amount ?? invoice.total)}
              </option>
            ))}
          </select>

          <button className="btn-primary w-full" onClick={submitPayment} disabled={loading}>
            {loading ? "Processing..." : "Record Payment"}
          </button>
        </div>
      </section>

      <section className="panel p-6 md:p-8">
        <p className="soft-label">Online Payment Link</p>
        <h2 className="mt-2 text-2xl font-bold text-slate-950">Create debit / credit payment</h2>

        <div className="mt-6 space-y-4">
          <select
            className="field"
            value={customerId}
            onChange={(e) => changeCustomer(e.target.value)}
          >
            <option value="">Select customer</option>
            {customers.map((customer) => (
              <option key={customer.id} value={customer.id}>
                {customer.name} {customer.mobile ? `(${customer.mobile})` : ""}
              </option>
            ))}
          </select>

          <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <p className="soft-label">Select invoices to send</p>
              {selectedInvoiceIds.length ? (
                <button
                  className="text-xs font-black uppercase tracking-[0.14em] text-red-600"
                  onClick={() => {
                    setSelectedInvoiceIds([]);
                    setKnetUrl("");
                    setAmount("");
                  }}
                  type="button"
                >
                  Clear
                </button>
              ) : null}
            </div>

            <div className="mt-3 space-y-2">
              {customerInvoices.map((invoice) => {
                const selected = selectedInvoiceIds.includes(invoice.id);

                return (
                  <button
                    key={invoice.id}
                    type="button"
                    className={`grid w-full gap-2 rounded-2xl border px-4 py-3 text-left transition md:grid-cols-[1fr_auto] md:items-center ${
                      selected
                        ? "border-red-500 bg-red-50 text-slate-950"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    }`}
                    onClick={() => toggleOnlineInvoice(invoice)}
                    disabled={!customerId}
                  >
                    <span>
                      <span className="block text-sm font-black">
                        {invoice.invoice_number ?? `Invoice #${invoice.id}`}
                      </span>
                      <span className="mt-1 block text-xs font-semibold text-slate-500">
                        {new Date(invoice.date).toLocaleDateString()} ·{" "}
                        {invoice.payment_status ?? "unpaid"}
                      </span>
                    </span>
                    <span className="text-sm font-black">
                      {formatDualCurrency(invoice.outstanding_amount ?? invoice.total)}
                    </span>
                  </button>
                );
              })}
              {customerId && !customerInvoices.length ? (
                <div className="rounded-2xl bg-white p-4 text-sm font-semibold text-slate-500">
                  No unpaid invoices for this customer.
                </div>
              ) : null}
            </div>
          </div>

          <div className="rounded-3xl bg-slate-50 p-5">
            <p className="soft-label">Selected</p>
            <p className="mt-2 text-lg font-bold text-slate-950">
              {selectedCustomer?.name ?? "No customer selected"}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {selectedInvoices.length
                ? `${selectedInvoices.length} invoice${
                    selectedInvoices.length === 1 ? "" : "s"
                  } selected - due ${formatDualCurrency(selectedOnlineAmount)}`
                : "No invoice selected"}
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              className="btn-primary w-full"
              onClick={() => createOnlinePaymentLink("knet")}
              disabled={Boolean(onlineLoading) || !selectedInvoices.length || knetAvailability?.configured === false}
            >
              {onlineLoading === "knet" ? "Creating Link..." : "Debit / KNET Link"}
            </button>
            <button
              className="btn-secondary w-full"
              onClick={() => createOnlinePaymentLink("card")}
              disabled={Boolean(onlineLoading) || !selectedInvoices.length || knetAvailability?.configured === false}
            >
              {onlineLoading === "card" ? "Creating Link..." : "Credit / Debit Card Link"}
            </button>
          </div>

          <div
            className={`space-y-3 rounded-3xl border p-4 ${
              knetUrl
                ? "border-emerald-100 bg-emerald-50"
                : "border-slate-100 bg-slate-50"
            }`}
          >
            {knetUrl ? (
              <>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-emerald-700">
                {onlineLinkKind === "card" ? "Card checkout" : "KNET checkout"}
              </p>
              <p className="break-all text-sm font-semibold text-emerald-800">{knetUrl}</p>
              </>
            ) : (
              <>
                <p className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                  WhatsApp sharing
                </p>
                <p className="text-sm font-semibold text-slate-600">
                  Create a debit, credit, or KNET payment link first, then send it to the
                  customer on WhatsApp.
                </p>
              </>
            )}
              <div className="grid gap-3 sm:grid-cols-3">
                <button className="btn-secondary" onClick={copyKnetLink} disabled={!knetUrl}>
                  Copy Link
                </button>
                <button className="btn-secondary" onClick={shareKnetViaWhatsApp}>
                  WhatsApp
                </button>
                <button
                  className="btn-secondary text-center"
                  disabled={!knetUrl}
                  onClick={() => window.open(knetUrl, "_blank", "noopener,noreferrer")}
                  type="button"
                >
                  Open Link
                </button>
              </div>
          </div>
        </div>
      </section>
      </div>

      <section className="panel p-6 md:p-8">
        <p className="soft-label">Current Position</p>
        <div className="mt-5 rounded-[32px] bg-[linear-gradient(135deg,#111111_0%,#2b1113_100%)] p-8 text-white">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-white/60">
            Balance
          </p>
          <p className="mt-3 text-5xl font-black tracking-tight">
            <Money value={customerId ? balance : 0} />
          </p>
          <p className="mt-3 max-w-md text-sm leading-6 text-white/70">
            Use this screen to reduce outstanding balance immediately after
            receiving cash, KNET, debit, or credit card payment.
          </p>
        </div>
      </section>

      <section className="panel p-6 md:p-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="soft-label">Recent Payments</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">Collection history</h2>
          </div>
          <p className="text-sm font-semibold text-slate-500">
            {isAdmin ? "Admins can reverse incorrect collections." : "Payment reversals are admin only."}
          </p>
        </div>

        <div className="mt-6 overflow-hidden rounded-3xl border border-slate-100">
          <div className="hidden grid-cols-[0.8fr_1.3fr_0.9fr_0.8fr_0.8fr_1fr] gap-3 bg-slate-50 px-5 py-3 text-xs font-black uppercase tracking-[0.14em] text-slate-400 md:grid">
            <span>ID</span>
            <span>Customer</span>
            <span>Invoice</span>
            <span>Mode</span>
            <span>Amount</span>
            <span className="text-right">Action</span>
          </div>

          <div className="divide-y divide-slate-100">
            {recentPayments.length ? (
              recentPayments.map((payment) => {
                const reversed = payment.status === "reversed";

                return (
                  <div
                    key={payment.id}
                    className="grid gap-3 px-5 py-4 md:grid-cols-[0.8fr_1.3fr_0.9fr_0.8fr_0.8fr_1fr] md:items-center"
                  >
                    <div>
                      <p className="text-sm font-black text-slate-950">#{payment.id}</p>
                      <p className="mt-1 text-xs font-semibold text-slate-400">
                        {new Date(payment.date).toLocaleDateString()}
                      </p>
                    </div>
                    <p className="text-sm font-bold text-slate-700">
                      {customerNameById.get(payment.customer_id) ?? `Customer #${payment.customer_id}`}
                    </p>
                    <p className="text-sm font-semibold text-slate-500">
                      {payment.invoice_id ? `#${payment.invoice_id}` : "General"}
                    </p>
                    <p className="text-sm font-bold uppercase text-slate-600">{payment.mode}</p>
                    <p className="text-sm font-black text-slate-950">
                      <Money value={payment.amount} />
                    </p>
                    <div className="flex items-center gap-3 md:justify-end">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-black uppercase tracking-[0.12em] ${
                          reversed
                            ? "bg-red-50 text-red-600"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {reversed ? "Reversed" : "Active"}
                      </span>
                      {isAdmin && !reversed ? (
                        <button
                          className="btn-secondary px-4 py-2 text-sm"
                          onClick={() => reversePayment(payment)}
                          disabled={reversalLoadingId === payment.id}
                        >
                          {reversalLoadingId === payment.id ? "Reversing..." : "Reverse"}
                        </button>
                      ) : null}
                    </div>
                    {reversed && payment.reversal_reason ? (
                      <p className="text-xs font-semibold text-slate-400 md:col-span-6">
                        Reason: {payment.reversal_reason}
                      </p>
                    ) : null}
                  </div>
                );
              })
            ) : (
              <div className="px-5 py-8 text-sm font-semibold text-slate-500">
                No payments recorded yet.
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
