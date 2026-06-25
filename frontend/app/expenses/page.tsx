"use client";

import { useEffect, useState } from "react";
import { fetchJson, fetchJsonOrThrow } from "../../lib/auth";
import { Money } from "../../lib/currency";

type ExpenseCategory = "rent" | "salary" | "fuel" | "transport" | "misc";

type Expense = {
  id: number;
  shipment_id?: number | null;
  title: string;
  amount: number;
  category: ExpenseCategory;
  date: string;
};

type Shipment = {
  id: number;
  name: string;
  reference_no?: string | null;
};

const categoryOptions: { value: ExpenseCategory; label: string }[] = [
  { value: "rent", label: "Rent" },
  { value: "salary", label: "Salary" },
  { value: "fuel", label: "Fuel" },
  { value: "transport", label: "Transport" },
  { value: "misc", label: "Misc" },
];

export default function ExpensesPage() {
  const [list, setList] = useState<Expense[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("misc");
  const [shipmentId, setShipmentId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState<"success" | "error">("success");

  const load = async () => {
    try {
      const params = new URLSearchParams();

      if (from) {
        params.set("from", from);
      }

      if (to) {
        params.set("to", to);
      }

      const suffix = params.toString() ? `?${params.toString()}` : "";
      const data = await fetchJson<Expense[]>(`/expenses${suffix}`);
      setList(Array.isArray(data) ? data : []);
      setStatus("");
    } catch (error) {
      setStatusType("error");
      setStatus(error instanceof Error ? error.message : "Could not load expenses.");
    }
  };

  useEffect(() => {
    Promise.all([fetchJson<Expense[]>("/expenses"), fetchJson<Shipment[]>("/shipments")])
      .then(([expenseData, shipmentData]) => {
        setList(Array.isArray(expenseData) ? expenseData : []);
        setShipments(Array.isArray(shipmentData) ? shipmentData : []);
        setStatus("");
      })
      .catch((error: Error) => {
        setStatusType("error");
        setStatus(error.message || "Could not load expenses.");
      });
  }, []);

  const total = list.reduce((sum, expense) => sum + Number(expense.amount), 0);

  const addExpense = async () => {
    if (!title.trim() || Number(amount) <= 0 || Number.isNaN(Number(amount))) {
      setStatusType("error");
      setStatus("Enter a title and a valid amount.");
      return;
    }

    setSaving(true);
    setStatus("");

    try {
      await fetchJsonOrThrow("/expenses", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          amount: Number(amount),
          category,
          shipment_id: shipmentId ? Number(shipmentId) : undefined,
        }),
      });

      setTitle("");
      setAmount("");
      setCategory("misc");
      setShipmentId("");
      setStatusType("success");
      setStatus("Expense added successfully.");
      await load();
      alert("✅ Expense created successfully");
    } catch (error) {
      setStatusType("error");
      setStatus(error instanceof Error ? error.message : "Could not add expense.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="panel p-6 md:p-8">
        <p className="soft-label">Expense Management</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
          Track operating costs
        </h1>
        <p className="mt-2 max-w-2xl text-base leading-7 text-slate-600">
          Record rent, salary, transport, and miscellaneous spending so profit can
          be measured against sales later.
        </p>
      </section>

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="panel p-6 md:p-8">
          <h2 className="text-xl font-bold text-slate-950">Add Expense</h2>
          <div className="mt-5 space-y-4">
            <input
              placeholder="Expense title"
              className="field"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />

            <input
              placeholder="Amount"
              className="field"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />

            <select
              className="field"
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
            >
              {categoryOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <select
              className="field"
              value={shipmentId}
              onChange={(e) => setShipmentId(e.target.value)}
            >
              <option value="">Shipment optional</option>
              {shipments.map((shipment) => (
                <option key={shipment.id} value={shipment.id}>
                  {shipment.name}{shipment.reference_no ? ` · ${shipment.reference_no}` : ""}
                </option>
              ))}
            </select>

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

            <button className="btn-primary w-full" onClick={addExpense} disabled={saving}>
              {saving ? "Processing..." : "Add Expense"}
            </button>
          </div>
        </div>

        <div className="panel p-6 md:p-8">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-bold text-slate-950">Recent Expenses</h2>
            <div className="status-pill bg-black/5 text-slate-700">
              {list.length} item{list.length === 1 ? "" : "s"}
            </div>
          </div>

          <div className="mb-5 grid gap-3 md:grid-cols-[1fr_1fr_auto]">
            <input
              type="date"
              className="field"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
            <input
              type="date"
              className="field"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
            <button className="btn-secondary" onClick={load}>
              Filter
            </button>
          </div>

          <div className="mb-5 rounded-3xl bg-red-50 px-5 py-4">
            <p className="soft-label text-red-700">Filtered Total</p>
            <p className="mt-2 text-3xl font-black tracking-tight text-red-600">
              <Money value={total} />
            </p>
          </div>

          <div className="space-y-3">
            {list.length === 0 ? (
              <div className="rounded-3xl bg-slate-50 px-5 py-6 text-sm font-medium text-slate-600">
                No expenses recorded yet.
              </div>
            ) : null}

            {list.map((expense) => (
              <div
                key={expense.id}
                className="rounded-3xl border border-black/8 bg-white px-5 py-4"
              >
                <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <p className="text-lg font-bold text-slate-950">{expense.title}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500">
                      {expense.category}
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {new Date(expense.date).toLocaleString()}
                    </p>
                  </div>

                  <p className="text-2xl font-black tracking-tight text-red-600">
                    <Money value={expense.amount} />
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
