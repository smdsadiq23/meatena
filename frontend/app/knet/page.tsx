"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchJson } from "../../lib/auth";
import { Money } from "../../lib/currency";

type KnetSession = {
  id: number;
  invoice_id: number;
  customer_id: number;
  amount: number;
  gateway_invoice_id?: string | null;
  payment_id?: string | null;
  payment_url: string;
  status: "pending" | "paid" | "failed" | "verified";
  error_message?: string | null;
  created_at: string;
  updated_at: string;
};

type KnetPayment = {
  id: number;
  customer_id: number;
  invoice_id?: number | null;
  amount: number;
  reference?: string | null;
  date: string;
};

type Reconciliation = {
  totals: {
    pending: number;
    paid: number;
    failed: number;
    verified: number;
    pendingAmount: number;
    paidAmount: number;
  };
  sessions: KnetSession[];
  paidPayments: KnetPayment[];
};

export default function KnetPage() {
  const [data, setData] = useState<Reconciliation | null>(null);
  const [status, setStatus] = useState("");
  const [filter, setFilter] = useState<"all" | KnetSession["status"]>("all");

  useEffect(() => {
    fetchJson<Reconciliation>("/payments/knet/reconciliation")
      .then((payload) => {
        setData(payload);
        setStatus("");
      })
      .catch((error: Error) => setStatus(error.message || "Could not load KNET data."));
  }, []);

  const sessions = useMemo(() => {
    const allSessions = data?.sessions ?? [];
    return filter === "all"
      ? allSessions
      : allSessions.filter((session) => session.status === filter);
  }, [data?.sessions, filter]);

  const cards = [
    { label: "Pending", value: data?.totals.pending ?? 0, amount: data?.totals.pendingAmount ?? 0 },
    { label: "Paid", value: data?.totals.paid ?? 0, amount: data?.totals.paidAmount ?? 0 },
    { label: "Failed", value: data?.totals.failed ?? 0, amount: null },
    { label: "Verified", value: data?.totals.verified ?? 0, amount: null },
  ];

  return (
    <div className="space-y-6">
      <section className="panel p-6 md:p-8">
        <p className="soft-label">KNET Reconciliation</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
          Remote payment sessions
        </h1>
        <p className="mt-2 text-base leading-7 text-slate-600">
          Track generated KNET links, completed payments, and unresolved sessions.
        </p>
      </section>

      {status ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {status}
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-4">
        {cards.map((card) => (
          <div key={card.label} className="panel p-5">
            <p className="soft-label">{card.label}</p>
            <p className="mt-3 text-3xl font-black text-slate-950">{card.value}</p>
            {card.amount !== null ? (
              <p className="mt-2 text-sm font-bold text-red-600">
                <Money value={card.amount} />
              </p>
            ) : null}
          </div>
        ))}
      </section>

      <section className="panel p-6">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-xl font-bold text-slate-950">Payment Links</h2>
          <select
            className="field md:max-w-52"
            value={filter}
            onChange={(event) => setFilter(event.target.value as typeof filter)}
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="paid">Paid</option>
            <option value="failed">Failed</option>
            <option value="verified">Verified</option>
          </select>
        </div>

        <div className="space-y-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm md:grid-cols-[1fr_1fr_1fr_1fr_auto]"
            >
              <div>
                <p className="font-bold text-slate-950">Invoice #{session.invoice_id}</p>
                <p className="text-slate-500">Customer #{session.customer_id}</p>
              </div>
              <div>
                <p className="soft-label">Amount</p>
                <p className="font-bold text-slate-950"><Money value={session.amount} /></p>
              </div>
              <div>
                <p className="soft-label">Status</p>
                <p className="font-bold capitalize text-slate-950">{session.status}</p>
              </div>
              <div className="min-w-0">
                <p className="soft-label">Gateway</p>
                <p className="truncate text-slate-600">
                  {session.payment_id || session.gateway_invoice_id || "-"}
                </p>
              </div>
              <a
                className="btn-secondary px-3 py-2 text-center text-xs"
                href={session.payment_url}
                target="_blank"
                rel="noreferrer"
              >
                Open
              </a>
            </div>
          ))}
          {sessions.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-4 text-sm font-medium text-slate-600">
              No KNET sessions found.
            </div>
          ) : null}
        </div>
      </section>

      <section className="panel p-6">
        <h2 className="mb-4 text-xl font-bold text-slate-950">Recorded KNET Payments</h2>
        <div className="space-y-2">
          {(data?.paidPayments ?? []).slice(0, 12).map((payment) => (
            <div key={payment.id} className="grid gap-3 rounded-2xl bg-slate-50 p-4 text-sm md:grid-cols-5">
              <div className="font-bold text-slate-950">Payment #{payment.id}</div>
              <div>Invoice #{payment.invoice_id ?? "-"}</div>
              <div>Customer #{payment.customer_id}</div>
              <div><Money value={payment.amount} /></div>
              <div className="truncate text-slate-500">{payment.reference || "-"}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
