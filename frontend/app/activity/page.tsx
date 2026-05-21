"use client";

import { useEffect, useMemo, useState } from "react";
import { fetchJson } from "../../lib/auth";

type AuditLog = {
  id: number;
  user_id?: number | null;
  username?: string | null;
  role?: string | null;
  action: string;
  entity: string;
  entity_id?: number | null;
  metadata?: Record<string, unknown>;
  date: string;
};

export default function ActivityPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [status, setStatus] = useState("");
  const [filter, setFilter] = useState("");

  useEffect(() => {
    fetchJson<AuditLog[]>("/audit")
      .then((data) => {
        setLogs(Array.isArray(data) ? data : []);
        setStatus("");
      })
      .catch((error: Error) => setStatus(error.message || "Could not load activity."));
  }, []);

  const filteredLogs = useMemo(() => {
    const keyword = filter.trim().toLowerCase();
    if (!keyword) {
      return logs;
    }

    return logs.filter((log) =>
      [log.username, log.role, log.action, log.entity, String(log.entity_id ?? "")]
        .filter(Boolean)
        .some((value) => value?.toLowerCase().includes(keyword))
    );
  }, [filter, logs]);

  return (
    <div className="space-y-6">
      <section className="panel p-6 md:p-8">
        <p className="soft-label">Staff Activity</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
          Operational audit log
        </h1>
        <p className="mt-2 text-base leading-7 text-slate-600">
          Review invoices, payments, purchases, stock adjustments, and KNET link creation.
        </p>
      </section>

      <section className="panel p-6">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <input
            className="field md:max-w-md"
            placeholder="Search by user, action, or entity"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
          />
          <span className="status-pill bg-black/5 text-slate-700">
            {filteredLogs.length} event{filteredLogs.length === 1 ? "" : "s"}
          </span>
        </div>

        {status ? (
          <div className="mb-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {status}
          </div>
        ) : null}

        <div className="space-y-3">
          {filteredLogs.map((log) => (
            <div key={log.id} className="rounded-2xl bg-slate-50 p-4">
              <div className="grid gap-3 text-sm md:grid-cols-[1fr_1fr_1fr_1.2fr]">
                <div>
                  <p className="soft-label">User</p>
                  <p className="mt-1 font-bold text-slate-950">
                    {log.username ?? "System"} {log.role ? `(${log.role})` : ""}
                  </p>
                </div>
                <div>
                  <p className="soft-label">Action</p>
                  <p className="mt-1 font-bold text-slate-950">{log.action}</p>
                </div>
                <div>
                  <p className="soft-label">Entity</p>
                  <p className="mt-1 text-slate-700">
                    {log.entity} {log.entity_id ? `#${log.entity_id}` : ""}
                  </p>
                </div>
                <div>
                  <p className="soft-label">Time</p>
                  <p className="mt-1 text-slate-600">{new Date(log.date).toLocaleString()}</p>
                </div>
              </div>
              {log.metadata && Object.keys(log.metadata).length > 0 ? (
                <pre className="mt-3 overflow-auto rounded-2xl bg-white p-3 text-xs text-slate-600">
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              ) : null}
            </div>
          ))}

          {filteredLogs.length === 0 ? (
            <div className="rounded-2xl bg-slate-50 p-5 text-sm font-medium text-slate-600">
              No activity found yet.
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}
