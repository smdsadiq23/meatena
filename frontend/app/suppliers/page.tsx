"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchJson, fetchJsonOrThrow } from "../../lib/auth";
import { formatDualCurrency, Money } from "../../lib/currency";

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

const emptySupplier = { name: "", mobile: "", address: "" };
const emptyPayment = {
  supplier_id: "",
  amount: "",
  mode: "cash",
  reference_no: "",
  note: "",
};

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [payments, setPayments] = useState<SupplierPayment[]>([]);
  const [form, setForm] = useState(emptySupplier);
  const [paymentForm, setPaymentForm] = useState(emptyPayment);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState<"success" | "error">("success");
  const [loading, setLoading] = useState(false);

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

  return (
    <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
      <section className="panel p-6 md:p-8">
        <p className="soft-label">Supplier Directory</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
          Suppliers and balances
        </h1>
        <input
          className="field mt-6"
          placeholder="Search suppliers"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="mt-6 space-y-3">
          {filteredSuppliers.map((supplier) => (
            <div key={supplier.id} className="rounded-3xl border border-black/8 bg-white p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <p className="text-lg font-bold text-slate-950">{supplier.name}</p>
                  <p className="mt-1 text-sm text-slate-600">{supplier.mobile || "No mobile"}</p>
                  <p className="mt-1 text-sm text-slate-500">{supplier.address || "No address"}</p>
                </div>
                <div className="flex flex-col gap-3 text-left md:items-end md:text-right">
                  <p className="soft-label">Balance</p>
                  <p className="mt-1 text-2xl font-black text-red-600">
                    <Money value={supplier.balance ?? 0} />
                  </p>
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
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-6">
        <div className="panel p-6 md:p-8">
          <p className="soft-label">Supplier Payment</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">Settle payable</h2>
          <div className="mt-6 space-y-4">
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
            <input
              className="field"
              placeholder="Amount"
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
              placeholder="Note"
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
              {loading ? "Processing..." : "Record Payment"}
            </button>
          </div>
        </div>

        <div className="panel p-6 md:p-8">
          <p className="soft-label">Quick Add</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">Create supplier</h2>
          <div className="mt-6 space-y-4">
            <input
              className="field"
              placeholder="Supplier name"
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

            <button className="btn-secondary w-full" onClick={createSupplier} disabled={loading}>
              {loading ? "Processing..." : "Add Supplier"}
            </button>
          </div>
        </div>
      </section>

      <section className="panel p-6 md:p-8 xl:col-span-2">
        <h2 className="mb-4 text-xl font-bold text-slate-950">Recent Supplier Payments</h2>
        <div className="space-y-2">
          {payments.slice(0, 12).map((payment) => (
            <div
              key={payment.id}
              className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm md:grid-cols-5"
            >
              <div className="font-bold text-slate-950">
                {supplierNameById.get(payment.supplier_id) ?? `Supplier #${payment.supplier_id}`}
              </div>
              <div><Money value={payment.amount} /></div>
              <div className="capitalize">{payment.mode}</div>
              <div>{payment.reference_no || "-"}</div>
              <div className="text-slate-500">{new Date(payment.date).toLocaleString()}</div>
            </div>
          ))}
          {payments.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-600">
              No supplier payments recorded yet.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
