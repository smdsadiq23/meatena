"use client";

import { useEffect, useMemo, useState } from "react";
import { API, fetchJson } from "../../lib/auth";
import {
  formatDualCurrency,
  loadCurrencyRate,
  Money,
  saveCurrencyRate,
  useCurrencyRate,
} from "../../lib/currency";

type HealthState = {
  status: "ok" | "degraded";
  service: string;
  timestamp: string;
  uptimeSeconds: number;
  dependencies: {
    database: {
      status: string;
      message?: string;
    };
    knet: {
      status: string;
      missing: string[];
    };
  };
};

type DashboardData = {
  todaySales?: number;
  todayCollection?: number;
  outstanding?: number;
  invoiceCount?: number;
};

type InventorySummary = {
  totals: {
    productCount: number;
    totalStockKg: number;
    estimatedRetailValue: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
};

type CreditSummary = {
  totals: {
    customerCount: number;
    dueCustomerCount: number;
    totalOutstanding: number;
    overLimitCount: number;
    nearLimitCount: number;
  };
};

type KnetAvailability = {
  configured: boolean;
  missingKeys: string[];
  mode: "mock" | "live";
  message: string;
};

type KnetReconciliation = {
  totals: {
    pending: number;
    paid: number;
    failed: number;
    verified: number;
    pendingAmount: number;
    paidAmount: number;
  };
};

type Check = {
  label: string;
  value: string;
  state: "ready" | "warn" | "danger";
  detail: string;
};

function StatusBadge({ state }: { state: Check["state"] }) {
  const classes = {
    ready: "bg-emerald-50 text-emerald-700",
    warn: "bg-amber-50 text-amber-700",
    danger: "bg-red-50 text-red-700",
  };

  return (
    <span className={`status-pill ${classes[state]}`}>
      {state === "ready" ? "Ready" : state === "warn" ? "Watch" : "Action"}
    </span>
  );
}

export default function SystemPage() {
  const currencyRate = useCurrencyRate();
  const [health, setHealth] = useState<HealthState | null>(null);
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [inventory, setInventory] = useState<InventorySummary | null>(null);
  const [credit, setCredit] = useState<CreditSummary | null>(null);
  const [knet, setKnet] = useState<KnetAvailability | null>(null);
  const [knetReconciliation, setKnetReconciliation] =
    useState<KnetReconciliation | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [currencyRateInput, setCurrencyRateInput] = useState("");
  const [currencySaving, setCurrencySaving] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadSystem() {
      setLoading(true);
      setStatus("");

      try {
        const [healthResponse, dashboardData, inventoryData, creditData, knetData, reconciliationData] =
          await Promise.all([
            fetch(`${API}/health`, { cache: "no-store" }).then((response) => {
              if (!response.ok) {
                throw new Error(`Health check failed with ${response.status}`);
              }

              return response.json() as Promise<HealthState>;
            }),
            fetchJson<DashboardData>("/invoices/dashboard"),
            fetchJson<InventorySummary>("/inventory/summary"),
            fetchJson<CreditSummary>("/customers/credit-summary"),
            fetchJson<KnetAvailability>("/payments/knet/availability"),
            fetchJson<KnetReconciliation>("/payments/knet/reconciliation"),
          ]);

        if (!active) {
          return;
        }

        setHealth(healthResponse);
        setDashboard(dashboardData);
        setInventory(inventoryData);
        setCredit(creditData);
        setKnet(knetData);
        setKnetReconciliation(reconciliationData);
      } catch (error) {
        if (active) {
          setStatus(error instanceof Error ? error.message : "Could not load system readiness.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadSystem();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setCurrencyRateInput(String(currencyRate));
  }, [currencyRate]);

  async function updateCurrencyRate() {
    const nextRate = Number(currencyRateInput);

    if (!Number.isFinite(nextRate) || nextRate <= 0) {
      setStatus("Enter a valid KWD to USD rate.");
      return;
    }

    setCurrencySaving(true);
    setStatus("");

    try {
      await saveCurrencyRate(nextRate);
      await loadCurrencyRate();
      setStatus("Currency rate updated.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not update currency rate.");
    } finally {
      setCurrencySaving(false);
    }
  }

  const checks = useMemo<Check[]>(() => {
    const databaseReady = health?.dependencies.database.status === "ok";
    const lowStockCount = inventory?.totals.lowStockCount ?? 0;
    const outOfStockCount = inventory?.totals.outOfStockCount ?? 0;
    const dueCustomerCount = credit?.totals.dueCustomerCount ?? 0;
    const pendingKnet = knetReconciliation?.totals.pending ?? 0;
    const failedKnet = knetReconciliation?.totals.failed ?? 0;
    const knetLive = knet?.mode === "live" && knet.configured;

    return [
      {
        label: "Backend",
        value: health?.status === "ok" ? "Online" : "Degraded",
        state: databaseReady ? "ready" : "danger",
        detail: databaseReady
          ? "API and database are responding."
          : health?.dependencies.database.message ?? "Database needs attention.",
      },
      {
        label: "KNET",
        value: knetLive ? "Live" : "Mock",
        state: knetLive ? "ready" : "warn",
        detail: knet?.message ?? "Gateway status is not available.",
      },
      {
        label: "Stock",
        value: `${lowStockCount} low`,
        state: outOfStockCount > 0 ? "danger" : lowStockCount > 0 ? "warn" : "ready",
        detail:
          outOfStockCount > 0
            ? `${outOfStockCount} items are out of stock.`
            : lowStockCount > 0
              ? "Low-stock items need purchase planning."
              : "No stock alerts right now.",
      },
      {
        label: "Collections",
        value: `${dueCustomerCount} due`,
        state: dueCustomerCount > 0 ? "warn" : "ready",
        detail:
          dueCustomerCount > 0
            ? `${formatDualCurrency(credit?.totals.totalOutstanding)} outstanding to follow up.`
            : "Customer balances are clear.",
      },
      {
        label: "KNET Sessions",
        value: `${pendingKnet} pending`,
        state: failedKnet > 0 ? "danger" : pendingKnet > 0 ? "warn" : "ready",
        detail:
          failedKnet > 0
            ? `${failedKnet} failed sessions need reconciliation.`
            : pendingKnet > 0
              ? "Pending links should be checked before closing."
              : "No pending KNET sessions.",
      },
    ];
  }, [credit, health, inventory, knet, knetReconciliation]);

  const actionItems = checks.filter((check) => check.state !== "ready");
  const readyCount = checks.filter((check) => check.state === "ready").length;

  return (
    <div className="space-y-6">
      <section className="panel p-6 md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="soft-label">System Readiness</p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
              Operations control check
            </h1>
            <p className="mt-2 max-w-2xl text-base leading-7 text-slate-600">
              One place to confirm backend, payments, stock, collections, and daily
              business signals before the counter starts.
            </p>
          </div>
          <div className="rounded-3xl bg-slate-950 px-6 py-5 text-white">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-white/55">
              Readiness
            </p>
            <p className="mt-2 text-3xl font-black">
              {readyCount}/{checks.length}
            </p>
          </div>
        </div>

        {status ? (
          <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {status}
          </div>
        ) : null}
      </section>

      {loading ? (
        <div className="panel p-6 text-sm font-semibold text-slate-600">
          Loading system checks...
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {checks.map((check) => (
          <div key={check.label} className="panel p-5">
            <div className="flex items-start justify-between gap-3">
              <p className="soft-label">{check.label}</p>
              <StatusBadge state={check.state} />
            </div>
            <p className="mt-4 text-2xl font-black text-slate-950">{check.value}</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{check.detail}</p>
          </div>
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <div className="panel p-6 md:p-8">
          <p className="soft-label">Today</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-3xl bg-red-50 p-5">
              <p className="text-sm font-bold text-red-700">Sales</p>
              <p className="mt-2 text-3xl font-black text-red-900">
                <Money value={dashboard?.todaySales} />
              </p>
            </div>
            <div className="rounded-3xl bg-emerald-50 p-5">
              <p className="text-sm font-bold text-emerald-700">Collections</p>
              <p className="mt-2 text-3xl font-black text-emerald-900">
                <Money value={dashboard?.todayCollection} />
              </p>
            </div>
            <div className="rounded-3xl bg-amber-50 p-5">
              <p className="text-sm font-bold text-amber-700">Outstanding</p>
              <p className="mt-2 text-3xl font-black text-amber-900">
                <Money value={dashboard?.outstanding} />
              </p>
            </div>
            <div className="rounded-3xl bg-slate-100 p-5">
              <p className="text-sm font-bold text-slate-700">Invoices</p>
              <p className="mt-2 text-3xl font-black text-slate-950">
                {dashboard?.invoiceCount ?? 0}
              </p>
            </div>
          </div>
        </div>

        <div className="panel p-6 md:p-8">
          <p className="soft-label">Action Queue</p>
          <div className="mt-5 space-y-3">
            {actionItems.length ? (
              actionItems.map((item) => (
                <div
                  key={item.label}
                  className="rounded-2xl border border-black/8 bg-slate-50 px-4 py-3"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-black text-slate-950">{item.label}</p>
                    <StatusBadge state={item.state} />
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.detail}</p>
                </div>
              ))
            ) : (
              <div className="rounded-2xl bg-emerald-50 px-4 py-4 text-sm font-semibold text-emerald-700">
                All checks are ready.
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="panel p-6 md:p-8">
        <div className="grid gap-5 lg:grid-cols-3">
          <div>
            <p className="soft-label">Backend</p>
            <p className="mt-3 text-sm font-semibold text-slate-700">
              Service: {health?.service ?? "-"}
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-700">
              Uptime: {health ? `${Math.floor(health.uptimeSeconds / 60)} min` : "-"}
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-700">
              Checked: {health ? new Date(health.timestamp).toLocaleString() : "-"}
            </p>
          </div>
          <div>
            <p className="soft-label">Inventory</p>
            <p className="mt-3 text-sm font-semibold text-slate-700">
              Products: {inventory?.totals.productCount ?? 0}
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-700">
              Stock: {Number(inventory?.totals.totalStockKg ?? 0).toFixed(3)} kg
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-700">
              Retail value: {formatDualCurrency(inventory?.totals.estimatedRetailValue)}
            </p>
          </div>
          <div>
            <p className="soft-label">KNET Config</p>
            <p className="mt-3 text-sm font-semibold text-slate-700">
              Mode: {knet?.mode ?? "-"}
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-700">
              Missing: {knet?.missingKeys.length ? knet.missingKeys.join(", ") : "None"}
            </p>
            <p className="mt-2 text-sm font-semibold text-slate-700">
              Paid amount: {formatDualCurrency(knetReconciliation?.totals.paidAmount)}
            </p>
          </div>
        </div>
      </section>

      <section className="panel p-6 md:p-8">
        <p className="soft-label">Currency Display</p>
        <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
          KWD to USD rate
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          This controls the USD helper shown beside KWD across web, mobile, WhatsApp
          messages, and generated PDFs.
        </p>
        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_auto]">
          <input
            className="field"
            inputMode="decimal"
            value={currencyRateInput}
            onChange={(event) => setCurrencyRateInput(event.target.value)}
            placeholder="KWD to USD rate"
          />
          <button
            className="btn-primary"
            type="button"
            onClick={() => void updateCurrencyRate()}
            disabled={currencySaving}
          >
            {currencySaving ? "Saving..." : "Save Rate"}
          </button>
        </div>
        <p className="mt-4 text-sm font-bold text-slate-700">
          Example: {formatDualCurrency(1)}
        </p>
      </section>
    </div>
  );
}
