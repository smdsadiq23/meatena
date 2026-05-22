"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { type MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { fetchJson, fetchJsonOrThrow, getAuthUser } from "../../lib/auth";
import { formatDualCurrency, Money } from "../../lib/currency";

type Customer = {
  id: number;
  name: string;
  mobile?: string;
  address?: string;
  credit_limit?: number;
};

type CollectionFollowUp = {
  id: number;
  name: string;
  mobile?: string | null;
  balance: number;
  credit_limit: number;
  credit_used_percent: number;
  last_invoice_date?: string | null;
  last_payment_date?: string | null;
  days_since_activity?: number | null;
  status: "due" | "near_limit" | "over_limit" | "clear";
};

type CollectionFollowUpResponse = {
  totals: {
    dueCustomerCount: number;
    totalOutstanding: number;
  };
  customers: CollectionFollowUp[];
};

const emptyForm = {
  name: "",
  mobile: "",
  address: "",
  credit_limit: "0",
};

export default function Customers() {
  const router = useRouter();
  const isAdmin = getAuthUser()?.role === "admin";
  const quickAddNameRef = useRef<HTMLInputElement>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [followups, setFollowups] = useState<CollectionFollowUp[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState<"success" | "error">("success");
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);

  const loadCustomers = async (preserveStatus = false) => {
    if (!preserveStatus) {
      setStatus("");
    }

    try {
      const [customerData, followupData] = await Promise.all([
        fetchJson<Customer[]>("/customers"),
        fetchJson<CollectionFollowUpResponse>("/customers/collection-followups"),
      ]);
      setCustomers(customerData);
      setFollowups(Array.isArray(followupData.customers) ? followupData.customers : []);
    } catch (error) {
      setStatusType("error");
      setStatus(error instanceof Error ? error.message : "Could not load customers.");
    }
  };

  useEffect(() => {
    Promise.all([
      fetchJson<Customer[]>("/customers"),
      fetchJson<CollectionFollowUpResponse>("/customers/collection-followups"),
    ])
      .then(([customerData, followupData]) => {
        setCustomers(customerData);
        setFollowups(Array.isArray(followupData.customers) ? followupData.customers : []);
        setStatus("");
      })
      .catch((error: Error) => {
        setStatusType("error");
        setStatus(error.message || "Could not load customers.");
      });
  }, []);

  const filteredCustomers = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    if (!keyword) {
      return customers;
    }

    return customers.filter((customer) =>
      [customer.name, customer.mobile, customer.address]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(keyword))
    );
  }, [customers, search]);

  const selectedCustomer = filteredCustomers[0] ?? customers[0] ?? null;
  const followupByCustomerId = useMemo(
    () => new Map(followups.map((followup) => [followup.id, followup])),
    [followups]
  );
  const followupTotals = useMemo(
    () =>
      followups.reduce(
        (summary, followup) => ({
          count: summary.count + 1,
          amount: summary.amount + Number(followup.balance),
        }),
        { count: 0, amount: 0 }
      ),
    [followups]
  );

  const createCustomer = async () => {
    if (!form.name.trim()) {
      setStatusType("error");
      setStatus("Customer name is required.");
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      const customer = await fetchJsonOrThrow<Customer>("/customers", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          mobile: form.mobile.trim() || undefined,
          address: form.address.trim() || undefined,
          credit_limit: Number(form.credit_limit || 0),
        }),
      });

      setForm(emptyForm);
      setStatusType("success");
      setStatus(`Customer ${customer.name} added successfully.`);
      await loadCustomers(true);
      alert("✅ Customer created successfully");
    } catch (error) {
      setStatusType("error");
      setStatus(error instanceof Error ? error.message : "Could not create customer.");
    } finally {
      setLoading(false);
    }
  };

  const clearQuickAdd = () => {
    setForm(emptyForm);
    setEditing(null);
    setStatus("");
    setStatusType("success");
    window.setTimeout(() => quickAddNameRef.current?.focus(), 0);
  };

  const openReports = () => {
    setStatus("");
    router.push("/reports");
  };

  const updateCustomer = async () => {
    if (!editing?.name.trim()) {
      setStatusType("error");
      setStatus("Customer name is required.");
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      const updatedCustomer = await fetchJsonOrThrow<Customer>(`/customers/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editing.name,
          mobile: editing.mobile,
          address: editing.address,
          credit_limit: Number(editing.credit_limit ?? 0),
        }),
      });

      setEditing(null);
      setStatusType("success");
      setStatus(`Customer ${updatedCustomer.name} updated successfully.`);
      await loadCustomers(true);
    } catch (error) {
      setStatusType("error");
      setStatus(error instanceof Error ? error.message : "Could not update customer.");
    } finally {
      setLoading(false);
    }
  };

  const deleteCustomer = async (id: number) => {
    if (!window.confirm("Delete customer?")) {
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      const response = await fetchJsonOrThrow<{ message: string }>(`/customers/${id}`, {
        method: "DELETE",
      });

      setStatusType("success");
      setStatus(response.message);
      if (editing?.id === id) {
        setEditing(null);
      }
      await loadCustomers(true);
    } catch (error) {
      setStatusType("error");
      setStatus(error instanceof Error ? error.message : "Could not delete customer.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="panel p-6 md:p-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="soft-label">Customer Directory</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              Search customers quickly
            </h1>
          </div>
          <button className="btn-secondary" type="button" onClick={clearQuickAdd} disabled={loading}>
            Clear Quick Add
          </button>
        </div>

        <div className="mt-6 rounded-3xl border border-red-100 bg-red-50/70 p-5">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="soft-label text-red-500">Collection Follow-up</p>
              <h2 className="mt-2 text-2xl font-black text-slate-950">
                {followupTotals.count} customers due
              </h2>
              <p className="mt-1 text-sm font-semibold text-slate-600">
                Outstanding {formatDualCurrency(followupTotals.amount)}
              </p>
            </div>
            {isAdmin ? (
              <button className="btn-secondary text-center" type="button" onClick={openReports}>
                View Reports
              </button>
            ) : null}
          </div>

          {followups.length ? (
            <div className="mt-5 grid gap-3">
              {followups.slice(0, 4).map((followup) => (
                <div
                  key={followup.id}
                  className="grid gap-3 rounded-2xl bg-white px-4 py-3 md:grid-cols-[1fr_auto] md:items-center"
                >
                  <div>
                    <p className="font-bold text-slate-950">{followup.name}</p>
                    <p className="mt-1 text-sm font-semibold text-red-600">
                      Due {formatDualCurrency(followup.balance)}
                      {followup.days_since_activity !== null &&
                      followup.days_since_activity !== undefined
                        ? ` • ${followup.days_since_activity} days since activity`
                        : ""}
                    </p>
                  </div>
                  <FollowUpActions followup={followup} />
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-4 text-sm font-semibold text-slate-600">
              No outstanding customer balances right now.
            </p>
          )}
        </div>

        <div className="mt-6">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, mobile, or address"
            className="field"
          />
        </div>

        <div className="mt-6 grid gap-3">
          {filteredCustomers.map((customer) => (
            <CustomerRow
              key={customer.id}
              customer={customer}
              followup={followupByCustomerId.get(customer.id)}
              onEdit={setEditing}
              onDelete={deleteCustomer}
              actionsDisabled={loading}
            />
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <div className="panel p-6 md:p-8">
          <p className="soft-label">Quick Add</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">Create customer</h2>

          <div className="mt-6 space-y-4">
            <input
              ref={quickAddNameRef}
              className="field"
              placeholder="Customer name"
              value={form.name}
              onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
            />
            <input
              className="field"
              placeholder="Mobile"
              value={form.mobile}
              onChange={(e) => setForm((current) => ({ ...current, mobile: e.target.value }))}
            />
            <input
              className="field"
              placeholder="Address"
              value={form.address}
              onChange={(e) => setForm((current) => ({ ...current, address: e.target.value }))}
            />
            <input
              className="field"
              placeholder="Credit limit (0 = unlimited)"
              value={form.credit_limit}
              onChange={(e) =>
                setForm((current) => ({ ...current, credit_limit: e.target.value }))
              }
            />

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

            <button className="btn-primary w-full" onClick={createCustomer} disabled={loading}>
              {loading ? "Processing..." : "Add Customer"}
            </button>
          </div>
        </div>

        <div className="panel p-6 md:p-8">
          <p className="soft-label">Selected Customer</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">
            {selectedCustomer?.name ?? "Choose a customer"}
          </h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="soft-label">Mobile</p>
              <p className="mt-2 text-lg font-bold text-slate-950">
                {selectedCustomer?.mobile || "Not available"}
              </p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="soft-label">Address</p>
              <p className="mt-2 text-lg font-bold text-slate-950">
                {selectedCustomer?.address || "Not available"}
              </p>
            </div>
            <div className="rounded-3xl bg-slate-50 p-5 sm:col-span-2">
              <p className="soft-label">Credit Limit</p>
              <p className="mt-2 text-lg font-bold text-slate-950">
                {Number(selectedCustomer?.credit_limit ?? 0) > 0
                  ? <Money value={selectedCustomer?.credit_limit ?? 0} />
                  : "Unlimited"}
              </p>
            </div>
          </div>
        </div>
      </section>

      {editing ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-6 shadow-2xl">
            <h2 className="text-2xl font-bold text-slate-950">Edit Customer</h2>

            <div className="mt-5 space-y-3">
              <input
                value={editing.name}
                onChange={(e) =>
                  setEditing((current) => (current ? { ...current, name: e.target.value } : current))
                }
                className="field"
                placeholder="Customer name"
              />

              <input
                value={editing.mobile || ""}
                onChange={(e) =>
                  setEditing((current) =>
                    current ? { ...current, mobile: e.target.value } : current
                  )
                }
                className="field"
                placeholder="Mobile"
              />

              <input
                value={editing.address || ""}
                onChange={(e) =>
                  setEditing((current) =>
                    current ? { ...current, address: e.target.value } : current
                  )
                }
                className="field"
                placeholder="Address"
              />

              <input
                value={String(editing.credit_limit ?? 0)}
                onChange={(e) =>
                  setEditing((current) =>
                    current ? { ...current, credit_limit: Number(e.target.value) } : current
                  )
                }
                className="field"
                placeholder="Credit limit (0 = unlimited)"
              />
            </div>

            <div className="mt-5 flex gap-3">
              <button className="btn-primary flex-1" onClick={updateCustomer} disabled={loading}>
                {loading ? "Saving..." : "Save"}
              </button>
              <button
                className="btn-secondary flex-1"
                onClick={() => setEditing(null)}
                disabled={loading}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CustomerRow({
  customer,
  followup,
  onEdit,
  onDelete,
  actionsDisabled,
}: {
  customer: Customer;
  followup?: CollectionFollowUp;
  onEdit: (customer: Customer) => void;
  onDelete: (id: number) => void;
  actionsDisabled: boolean;
}) {
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    fetchJson<{ balance?: number }>(`/ledger/balance/${customer.id}`)
      .then((data) => setBalance(Number(data.balance) || 0))
      .catch(() => setBalance(0));
  }, [customer.id]);

  return (
    <div className="grid gap-5 rounded-3xl border border-black/8 bg-white px-5 py-4 text-left transition hover:border-red-100 hover:bg-red-50/40 lg:grid-cols-[minmax(220px,1fr)_170px_minmax(260px,auto)] lg:items-center">
      <div className="min-w-0">
        <p className="text-lg font-bold text-slate-950">{customer.name}</p>
        <p className="mt-1 text-sm text-slate-600">{customer.mobile || "No mobile"}</p>
        <p className="mt-1 text-xs text-slate-500">{customer.address || "No address"}</p>
        <p className="mt-1 text-xs text-slate-500">
          Limit:{" "}
          {Number(customer.credit_limit ?? 0) > 0
            ? formatDualCurrency(customer.credit_limit ?? 0)
            : "Unlimited"}
        </p>
      </div>

      <div className="rounded-2xl bg-slate-50 px-4 py-3 text-left lg:text-right">
        <div
          className={`text-xl font-black leading-tight ${balance > 0 ? "text-red-500" : "text-green-600"}`}
        >
          <Money value={balance} />
        </div>
        <div className="mt-1 text-xs font-black uppercase tracking-[0.2em] text-slate-500">
          {balance > 0 ? "Due" : "Clear"}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:justify-start lg:justify-end">
        <Link
          className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-slate-950 px-4 py-2 text-sm font-bold text-white shadow-sm transition hover:bg-slate-800"
          href={`/statement?customer=${customer.id}`}
        >
          Statement
        </Link>
        {followup ? <FollowUpActions followup={followup} compact /> : null}
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-amber-400 px-4 py-2 text-sm font-bold text-slate-950 transition hover:bg-amber-300 disabled:opacity-50"
          onClick={(event) => {
            event.stopPropagation();
            onEdit(customer);
          }}
          disabled={actionsDisabled}
        >
          Edit
        </button>
        <button
          className="inline-flex min-h-11 items-center justify-center rounded-2xl bg-red-600 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-500 disabled:opacity-50"
          onClick={(event) => {
            event.stopPropagation();
            onDelete(customer.id);
          }}
          disabled={actionsDisabled}
        >
          Delete
        </button>
      </div>
    </div>
  );
}

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

function buildFollowUpMessage(followup: CollectionFollowUp) {
  return [
    `Hello ${followup.name},`,
    `Your outstanding balance is ${formatDualCurrency(followup.balance)}.`,
    "Please arrange payment or contact us if you need your account statement.",
    "Thank you.",
  ].join("\n");
}

function FollowUpActions({
  followup,
  compact = false,
}: {
  followup: CollectionFollowUp;
  compact?: boolean;
}) {
  const mobile = normalizeWhatsAppNumber(followup.mobile);
  const message = buildFollowUpMessage(followup);
  const whatsappUrl = mobile
    ? `https://wa.me/${mobile}?text=${encodeURIComponent(message)}`
    : "";

  const copyMessage = async (event: MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();

    try {
      await navigator.clipboard.writeText(message);
      alert("Reminder copied.");
    } catch {
      alert("Could not copy reminder.");
    }
  };

  return (
    <div className={`flex gap-2 ${compact ? "items-center" : "md:justify-end"}`}>
      {whatsappUrl ? (
        <a
          className="rounded-2xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(event) => event.stopPropagation()}
        >
          WhatsApp
        </a>
      ) : null}
      <button
        className="rounded-2xl bg-slate-950 px-3 py-2 text-sm font-semibold text-white"
        onClick={copyMessage}
      >
        Copy
      </button>
    </div>
  );
}
