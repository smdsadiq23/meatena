"use client";

import { startTransition, useEffect, useEffectEvent, useMemo, useState } from "react";
import { fetchJson, fetchJsonOrThrow, getAuthUser } from "../../lib/auth";
import { formatDualCurrency, Money } from "../../lib/currency";

type ShiftSummary = {
  date: string;
  user_id: number | null;
  payment_count: number;
  system_cash: number;
  system_knet: number;
  system_total: number;
  close?: ShiftClose | null;
};

type ShiftClose = {
  id: number;
  user_id: number;
  username: string;
  role: string;
  date: string;
  system_cash: number;
  system_knet: number;
  system_total: number;
  counted_cash: number;
  counted_knet: number;
  counted_total: number;
  variance_cash: number;
  variance_knet: number;
  variance_total: number;
  notes?: string | null;
  status: "submitted" | "reviewed";
  review_notes?: string | null;
};

type User = {
  id: number;
  username: string;
  role: "admin" | "staff";
};

export default function ShiftClosePage() {
  const authUser = getAuthUser();
  const isAdmin = authUser?.role === "admin";
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [summary, setSummary] = useState<ShiftSummary | null>(null);
  const [closes, setCloses] = useState<ShiftClose[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [countedCash, setCountedCash] = useState("");
  const [countedKnet, setCountedKnet] = useState("");
  const [notes, setNotes] = useState("");
  const [status, setStatus] = useState("");
  const [statusType, setStatusType] = useState<"success" | "error">("success");
  const [loading, setLoading] = useState(false);
  const [reviewingId, setReviewingId] = useState<number | null>(null);

  const summaryQuery = useMemo(() => {
    const params = new URLSearchParams({ date });
    if (isAdmin && selectedUserId) {
      params.set("user_id", selectedUserId);
    }
    return params.toString();
  }, [date, isAdmin, selectedUserId]);

  const loadShiftData = async () => {
    setStatus("");

    try {
      const [summaryData, closeData] = await Promise.all([
        fetchJson<ShiftSummary>(`/shift-close/summary?${summaryQuery}`),
        fetchJson<ShiftClose[]>("/shift-close"),
      ]);
      startTransition(() => {
        setSummary(summaryData);
        setCloses(Array.isArray(closeData) ? closeData : []);
        setCountedCash(summaryData.close ? String(summaryData.close.counted_cash) : "");
        setCountedKnet(summaryData.close ? String(summaryData.close.counted_knet) : "");
        setNotes(summaryData.close?.notes ?? "");
      });
    } catch (error) {
      startTransition(() => {
        setStatusType("error");
        setStatus(error instanceof Error ? error.message : "Could not load shift close.");
      });
    }
  };

  const loadShiftDataEffect = useEffectEvent(() => {
    void loadShiftData();
  });

  useEffect(() => {
    loadShiftDataEffect();
  }, [summaryQuery]);

  useEffect(() => {
    if (!isAdmin) {
      return;
    }

    fetchJson<User[]>("/users")
      .then((data) => setUsers(Array.isArray(data) ? data : []))
      .catch(() => setUsers([]));
  }, [isAdmin]);

  const submitClose = async () => {
    if (!countedCash) {
      setStatusType("error");
      setStatus("Enter counted cash before submitting shift close.");
      return;
    }

    setLoading(true);
    setStatus("");

    try {
      await fetchJsonOrThrow<ShiftClose>("/shift-close", {
        method: "POST",
        body: JSON.stringify({
          date,
          counted_cash: Number(countedCash),
          counted_knet: countedKnet ? Number(countedKnet) : 0,
          notes: notes.trim() || undefined,
        }),
      });
      setStatusType("success");
      setStatus("Shift close submitted.");
      await loadShiftData();
    } catch (error) {
      setStatusType("error");
      setStatus(error instanceof Error ? error.message : "Could not submit shift close.");
    } finally {
      setLoading(false);
    }
  };

  const reviewClose = async (close: ShiftClose) => {
    const reviewNotes = prompt("Review notes?");
    if (reviewNotes === null) {
      return;
    }

    setReviewingId(close.id);
    setStatus("");

    try {
      await fetchJsonOrThrow<ShiftClose>(`/shift-close/${close.id}/review`, {
        method: "POST",
        body: JSON.stringify({ notes: reviewNotes.trim() || undefined }),
      });
      setStatusType("success");
      setStatus("Shift close reviewed.");
      await loadShiftData();
    } catch (error) {
      setStatusType("error");
      setStatus(error instanceof Error ? error.message : "Could not review shift close.");
    } finally {
      setReviewingId(null);
    }
  };

  const expectedCash = summary?.system_cash ?? 0;
  const expectedKnet = summary?.system_knet ?? 0;
  const countedTotal = Number(countedCash || 0) + Number(countedKnet || 0);
  const variance = countedTotal - (summary?.system_total ?? 0);

  return (
    <div className="space-y-6">
      <section className="panel p-6 md:p-8">
        <p className="soft-label">Staff Operations</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
          Shift close
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
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2">
              <span className="soft-label">Business Date</span>
              <input className="field" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
            </label>

            {isAdmin ? (
              <label className="space-y-2">
                <span className="soft-label">Staff Filter</span>
                <select className="field" value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)}>
                  <option value="">All staff</option>
                  {users.map((user) => (
                    <option key={user.id} value={user.id}>
                      {user.username} ({user.role})
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <Metric label="System cash" value={expectedCash} />
            <Metric label="System KNET" value={expectedKnet} />
            <Metric label="Payments" value={summary?.payment_count ?? 0} plain />
            <Metric label="System total" value={summary?.system_total ?? 0} dark />
          </div>
        </section>

        <section className="panel p-6 md:p-8">
          <p className="soft-label">Drawer Count</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">Submit counted amount</h2>

          <div className="mt-6 space-y-4">
            <input className="field" placeholder="Counted cash" value={countedCash} onChange={(event) => setCountedCash(event.target.value)} />
            <input className="field" placeholder="Counted KNET" value={countedKnet} onChange={(event) => setCountedKnet(event.target.value)} />
            <textarea className="field min-h-28" placeholder="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} />

            <div className="rounded-3xl bg-slate-50 p-5">
              <p className="soft-label">Variance</p>
              <p className={`mt-2 text-3xl font-black ${Math.abs(variance) > 0.001 ? "text-red-600" : "text-emerald-700"}`}>
                <Money value={variance} />
              </p>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Counted total {formatDualCurrency(countedTotal)}
              </p>
            </div>

            <button className="btn-primary w-full" onClick={submitClose} disabled={loading || summary?.close?.status === "reviewed"}>
              {loading ? "Submitting..." : summary?.close ? "Update Shift Close" : "Submit Shift Close"}
            </button>
          </div>
        </section>
      </div>

      <section className="panel p-6 md:p-8">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="soft-label">Close History</p>
            <h2 className="mt-2 text-2xl font-bold text-slate-950">Submitted shifts</h2>
          </div>
        </div>

        <div className="mt-6 divide-y divide-slate-100 overflow-hidden rounded-3xl border border-slate-100">
          {closes.length ? (
            closes.map((close) => (
              <div key={close.id} className="grid gap-3 px-5 py-4 lg:grid-cols-[0.8fr_1fr_0.9fr_0.9fr_0.9fr_1fr] lg:items-center">
                <div>
                  <p className="text-sm font-black text-slate-950">{close.date}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">{close.status}</p>
                </div>
                <p className="text-sm font-bold text-slate-700">{close.username}</p>
                <p className="text-sm font-semibold text-slate-500">System {formatDualCurrency(close.system_total)}</p>
                <p className="text-sm font-semibold text-slate-500">Counted {formatDualCurrency(close.counted_total)}</p>
                <p className={`text-sm font-black ${Math.abs(Number(close.variance_total)) > 0.001 ? "text-red-600" : "text-emerald-700"}`}>
                  Var {formatDualCurrency(close.variance_total)}
                </p>
                <div className="flex justify-start lg:justify-end">
                  {isAdmin && close.status !== "reviewed" ? (
                    <button className="btn-secondary px-4 py-2 text-sm" onClick={() => reviewClose(close)} disabled={reviewingId === close.id}>
                      {reviewingId === close.id ? "Reviewing..." : "Mark Reviewed"}
                    </button>
                  ) : (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
                      {close.status}
                    </span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="px-5 py-8 text-sm font-semibold text-slate-500">
              No shift closes submitted yet.
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Metric({
  label,
  value,
  dark,
  plain,
}: {
  label: string;
  value: number;
  dark?: boolean;
  plain?: boolean;
}) {
  return (
    <div className={`rounded-3xl p-5 ${dark ? "bg-slate-950 text-white" : "bg-slate-50 text-slate-950"}`}>
      <p className={`soft-label ${dark ? "text-white/55" : ""}`}>{label}</p>
      <p className="mt-2 text-3xl font-black">{plain ? value : <Money value={value} />}</p>
    </div>
  );
}
