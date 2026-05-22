"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "../../lib/auth";
import { Money } from "../../lib/currency";
import { useLanguage } from "../../lib/use-language";

type DashboardData = {
  todaySales?: number;
  todayCollection?: number;
  outstanding?: number;
  invoiceCount?: number;
};

type ProfitData = {
  sales?: number;
  expenseTotal?: number;
  profit?: number;
};

type InventorySummary = {
  totals: {
    productCount: number;
    totalStockKg: number;
    estimatedRetailValue: number;
    lowStockCount: number;
    outOfStockCount: number;
  };
  lowStockItems: Array<{
    id: number;
    name: string;
    sku?: string | null;
    stock_kg: number;
    low_stock_kg: number;
  }>;
};

export default function Dashboard() {
  const { t } = useLanguage();
  const [data, setData] = useState<DashboardData>({});
  const [profitData, setProfitData] = useState<ProfitData>({});
  const [inventorySummary, setInventorySummary] = useState<InventorySummary | null>(null);
  const [status, setStatus] = useState("");

  useEffect(() => {
    fetchJson<DashboardData>("/invoices/dashboard")
      .then(setData)
      .catch((error: Error) => setStatus(error.message || "Could not load dashboard."));

    fetchJson<ProfitData>("/invoices/profit")
      .then(setProfitData)
      .catch((error: Error) => setStatus(error.message || "Could not load profit data."));

    fetchJson<InventorySummary>("/inventory/summary")
      .then(setInventorySummary)
      .catch((error: Error) => setStatus(error.message || "Could not load inventory summary."));
  }, []);

  const cards = [
    {
      title: t("Today Sales"),
      value: data.todaySales ?? 0,
      money: true,
      classes: "bg-[linear-gradient(135deg,#ef4444_0%,#b91c1c_100%)] text-white",
    },
    {
      title: t("Collection"),
      value: data.todayCollection ?? 0,
      money: true,
      classes: "bg-[linear-gradient(135deg,#22c55e_0%,#15803d_100%)] text-white",
    },
    {
      title: t("Outstanding"),
      value: data.outstanding ?? 0,
      money: true,
      classes: "bg-[linear-gradient(135deg,#fde68a_0%,#f59e0b_100%)] text-slate-950",
    },
    {
      title: t("Invoices"),
      value: data.invoiceCount ?? 0,
      money: false,
      classes: "bg-[linear-gradient(135deg,#3b82f6_0%,#1d4ed8_100%)] text-white",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="panel p-8">
        <p className="soft-label">{t("Business Snapshot")}</p>
        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
          {t("Meatena dashboard")}
        </h1>
        <p className="mt-2 max-w-2xl text-base leading-7 text-slate-600">
          {t("Watch daily sales and collections without leaving the admin panel.")}
        </p>
        {status ? (
          <div className="mt-4 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {status}
          </div>
        ) : null}
      </div>

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div key={card.title} className={`rounded-[28px] p-6 shadow-xl [container-type:inline-size] ${card.classes}`}>
            <h2 className="text-sm font-semibold uppercase tracking-[0.16em] opacity-80">
              {card.title}
            </h2>
            <p className="mt-6 max-w-full text-[clamp(2rem,13cqw,3rem)] font-black leading-none tracking-normal">
              {card.money ? <Money value={card.value} /> : String(card.value)}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 md:grid-cols-3">
        <div className="rounded-[28px] bg-gray-800 p-6 text-white shadow-xl [container-type:inline-size]">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] opacity-80">
            {t("Sales")}
          </h3>
          <p className="mt-6 max-w-full text-[clamp(2rem,11cqw,3rem)] font-black leading-none tracking-normal">
            <Money value={profitData.sales ?? 0} />
          </p>
        </div>

        <div className="rounded-[28px] bg-red-600 p-6 text-white shadow-xl [container-type:inline-size]">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] opacity-80">
            {t("Expenses")}
          </h3>
          <p className="mt-6 max-w-full text-[clamp(2rem,11cqw,3rem)] font-black leading-none tracking-normal">
            <Money value={profitData.expenseTotal ?? 0} />
          </p>
        </div>

        <div className="rounded-[28px] bg-green-600 p-6 text-white shadow-xl [container-type:inline-size]">
          <h3 className="text-sm font-semibold uppercase tracking-[0.16em] opacity-80">
            {t("Profit")}
          </h3>
          <p className="mt-6 max-w-full text-[clamp(2rem,11cqw,3rem)] font-black leading-none tracking-normal">
            <Money value={profitData.profit ?? 0} />
          </p>
        </div>
      </div>

      {inventorySummary ? (
        <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="panel p-6 md:p-8">
            <p className="soft-label">{t("Inventory Snapshot")}</p>
            <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div className="rounded-3xl bg-blue-50 p-5">
                <p className="soft-label text-blue-700">{t("Retail Stock Value")}</p>
                <p className="mt-2 text-3xl font-black text-blue-800">
                  <Money value={inventorySummary.totals.estimatedRetailValue} />
                </p>
              </div>
              <div className="rounded-3xl bg-amber-50 p-5">
                <p className="soft-label text-amber-700">{t("Low Stock Items")}</p>
                <p className="mt-2 text-3xl font-black text-amber-800">
                  {inventorySummary.totals.lowStockCount}
                </p>
              </div>
            </div>
          </section>

          <section className="panel p-6 md:p-8">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="soft-label">{t("Restock Watch")}</p>
                <h2 className="mt-2 text-xl font-bold text-slate-950">
                  {t("Lowest stock items")}
                </h2>
              </div>
              <div className="status-pill bg-red-50 text-red-700">
                {inventorySummary.totals.outOfStockCount} {t("out")}
              </div>
            </div>

            <div className="mt-5 space-y-2">
              {inventorySummary.lowStockItems.length ? (
                inventorySummary.lowStockItems.slice(0, 5).map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-[1fr_auto_auto] gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm"
                  >
                    <div>
                      <p className="font-bold text-slate-950">{item.name}</p>
                      <p className="mt-1 text-xs text-slate-500">{item.sku || t("No SKU")}</p>
                    </div>
                    <div className="font-black text-slate-950">
                      {Number(item.stock_kg).toFixed(3)} kg
                    </div>
                    <div className="text-slate-500">
                      {t("Min")} {Number(item.low_stock_kg).toFixed(3)}
                    </div>
                  </div>
                ))
              ) : (
                <div className="rounded-2xl bg-emerald-50 px-4 py-4 text-sm font-semibold text-emerald-700">
                  {t("No low-stock items right now.")}
                </div>
              )}
            </div>
          </section>
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="panel p-8">
          <p className="soft-label">{t("Performance Note")}</p>
          <p className="mt-4 text-2xl font-bold text-slate-950">
            {t("Keep billing moving during rush hours.")}
          </p>
          <p className="mt-3 text-base leading-7 text-slate-600">
            {t("Use the billing page for fast multi-item entry, then jump to payments or statements directly from the sidebar when customers need updates.")}
          </p>
        </div>

        <div className="panel p-8">
          <p className="soft-label">{t("Focus")}</p>
          <ul className="mt-4 space-y-4 text-sm leading-6 text-slate-700">
            <li>{t("Track today's sales before closing shift.")}</li>
            <li>{t("Follow outstanding balances before issuing fresh credit.")}</li>
            <li>{t("Review invoice count to measure counter workload.")}</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
