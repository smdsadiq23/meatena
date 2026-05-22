"use client";

import { useEffect, useState } from "react";
import { fetchJson } from "../../lib/auth";
import { Money } from "../../lib/currency";

type ReportType = "day" | "week" | "month" | "year";

type ReportData = {
  type: ReportType;
  sales: number;
  expenses: number;
  profit: number;
};

type CreditCustomer = {
  id: number;
  name: string;
  mobile?: string | null;
  balance: number;
  credit_limit: number;
  remaining_credit: number | null;
  credit_used_percent: number;
  status: "clear" | "due" | "near_limit" | "over_limit";
};

type CreditSummary = {
  totals: {
    customerCount: number;
    dueCustomerCount: number;
    totalOutstanding: number;
    overLimitCount: number;
    nearLimitCount: number;
  };
  customers: CreditCustomer[];
};

type DailyClose = {
  date: string;
  totals: {
    invoiceCount: number;
    paymentCount: number;
    reversalCount?: number;
    expenseCount: number;
    salesTotal: number;
    cashSales: number;
    creditSales: number;
    collectionTotal: number;
    reversalTotal?: number;
    netCollection?: number;
    cashCollection: number;
    knetCollection: number;
    expenseTotal: number;
    netCash: number;
    profitEstimate: number;
    creditMovement: number;
  };
  invoices: Array<{
    id: number;
    customer_name: string;
    total: number;
    type: string;
  }>;
  payments: Array<{
    id: number;
    customer_name: string;
    amount: number;
    mode: string;
  }>;
  reversals?: Array<{
    id: number;
    customer_name: string;
    amount: number;
    mode: string;
  }>;
  expenses: Array<{
    id: number;
    title: string;
    category: string;
    amount: number;
  }>;
};

type HistoricReport = {
  range: {
    from: string;
    to: string;
  };
  totals: {
    invoiceCount: number;
    voidInvoiceCount: number;
    paymentCount: number;
    reversalCount: number;
    expenseCount: number;
    purchaseCount: number;
    stockMovementCount: number;
    salesTotal: number;
    cashSales: number;
    creditSales: number;
    collectionTotal: number;
    cashCollection: number;
    knetCollection: number;
    reversalTotal: number;
    netCollection: number;
    expenseTotal: number;
    purchaseTotal: number;
    grossProfit: number;
    netCash: number;
    stockInKg: number;
    stockOutKg: number;
    wastageKg: number;
  };
  invoices: Array<{
    id: number;
    invoice_number: string;
    customer_name: string;
    total: number;
    type: string;
    date: string;
  }>;
  payments: Array<{
    id: number;
    customer_name: string;
    amount: number;
    mode: string;
    date: string;
  }>;
  expenses: Array<{
    id: number;
    title: string;
    category: string;
    amount: number;
    date: string;
  }>;
  purchases: Array<{
    id: number;
    supplier_name: string;
    invoice_no?: string | null;
    total: number;
    date: string;
  }>;
  stockMovements: Array<{
    id: number;
    product_name: string;
    type: string;
    quantity_kg: number;
    balance_after_kg: number;
    date: string;
  }>;
  topCustomers: Array<{
    id: number;
    name: string;
    sales: number;
    collected: number;
    invoiceCount: number;
  }>;
  topProducts: Array<{
    id: number;
    name: string;
    soldKg: number;
    purchasedKg: number;
    currentStockKg: number;
  }>;
};

const reportOptions: { value: ReportType; label: string; caption: string }[] = [
  { value: "day", label: "Day", caption: "Today" },
  { value: "week", label: "Week", caption: "This week" },
  { value: "month", label: "Month", caption: "This month" },
  { value: "year", label: "Year", caption: "This year" },
];

function csvCell(value: string | number | null | undefined) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, rows: Array<Array<string | number | null | undefined>>) {
  const csv = rows.map((row) => row.map(csvCell).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function exportHistoricCsv(report: HistoricReport) {
  const rows: Array<Array<string | number | null | undefined>> = [
    ["Historic Report", `${report.range.from} to ${report.range.to}`],
    [],
    ["Totals"],
    ["Sales", report.totals.salesTotal],
    ["Collections", report.totals.netCollection],
    ["Expenses", report.totals.expenseTotal],
    ["Profit", report.totals.grossProfit],
    ["Purchases", report.totals.purchaseTotal],
    ["Cash Collection", report.totals.cashCollection],
    ["KNET Collection", report.totals.knetCollection],
    ["Stock In kg", report.totals.stockInKg],
    ["Stock Out kg", report.totals.stockOutKg],
    ["Wastage kg", report.totals.wastageKg],
    [],
    ["Invoices"],
    ["ID", "Invoice No", "Customer", "Type", "Date", "Total"],
    ...report.invoices.map((invoice) => [
      invoice.id,
      invoice.invoice_number,
      invoice.customer_name,
      invoice.type,
      invoice.date,
      invoice.total,
    ]),
    [],
    ["Payments"],
    ["ID", "Customer", "Mode", "Date", "Amount"],
    ...report.payments.map((payment) => [
      payment.id,
      payment.customer_name,
      payment.mode,
      payment.date,
      payment.amount,
    ]),
    [],
    ["Purchases"],
    ["ID", "Supplier", "Supplier Invoice", "Date", "Total"],
    ...report.purchases.map((purchase) => [
      purchase.id,
      purchase.supplier_name,
      purchase.invoice_no,
      purchase.date,
      purchase.total,
    ]),
    [],
    ["Expenses"],
    ["ID", "Title", "Category", "Date", "Amount"],
    ...report.expenses.map((expense) => [
      expense.id,
      expense.title,
      expense.category,
      expense.date,
      expense.amount,
    ]),
    [],
    ["Stock Movements"],
    ["ID", "Product", "Type", "Date", "Quantity kg", "Balance After kg"],
    ...report.stockMovements.map((movement) => [
      movement.id,
      movement.product_name,
      movement.type,
      movement.date,
      movement.quantity_kg,
      movement.balance_after_kg,
    ]),
    [],
    ["Top Customers"],
    ["ID", "Customer", "Sales", "Collected", "Invoice Count"],
    ...report.topCustomers.map((customer) => [
      customer.id,
      customer.name,
      customer.sales,
      customer.collected,
      customer.invoiceCount,
    ]),
    [],
    ["Top Products"],
    ["ID", "Product", "Sold kg", "Purchased kg", "Current Stock kg"],
    ...report.topProducts.map((product) => [
      product.id,
      product.name,
      product.soldKg,
      product.purchasedKg,
      product.currentStockKg,
    ]),
  ];

  downloadCsv(`historic-report-${report.range.from}-to-${report.range.to}.csv`, rows);
}

export default function ReportsPage() {
  const [type, setType] = useState<ReportType>("month");
  const [data, setData] = useState<ReportData | null>(null);
  const [creditSummary, setCreditSummary] = useState<CreditSummary | null>(null);
  const [closeDate, setCloseDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [dailyClose, setDailyClose] = useState<DailyClose | null>(null);
  const [historicFrom, setHistoricFrom] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 29);
    return date.toISOString().slice(0, 10);
  });
  const [historicTo, setHistoricTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [historic, setHistoric] = useState<HistoricReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [historicLoading, setHistoricLoading] = useState(true);
  const [status, setStatus] = useState("");

  const loadHistoric = async (from = historicFrom, to = historicTo) => {
    setHistoricLoading(true);
    setStatus("");

    try {
      const report = await fetchJson<HistoricReport>(
        `/invoices/historic-report?from=${from}&to=${to}`
      );
      setHistoric(report);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load historic report.");
    } finally {
      setHistoricLoading(false);
    }
  };

  const loadDailyClose = async (date: string) => {
    setStatus("");

    try {
      const close = await fetchJson<DailyClose>(`/invoices/daily-close?date=${date}`);
      setDailyClose(close);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load daily close.");
    }
  };

  const load = async (nextType: ReportType, updateType = true) => {
    if (updateType) {
      setType(nextType);
    }

    setLoading(true);
    setStatus("");

    try {
      const report = await fetchJson<ReportData>(`/invoices/report?type=${nextType}`);
      setData(report);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load report.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;

    void fetchJson<ReportData>("/invoices/report?type=month")
      .then((report) => {
        if (!active) {
          return;
        }

        setData(report);
        setStatus("");
      })
      .catch((error: Error) => {
        if (!active) {
          return;
        }

        setStatus(error.message || "Could not load report.");
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    void fetchJson<CreditSummary>("/customers/credit-summary")
      .then((summary) => {
        if (!active) {
          return;
        }

        setCreditSummary(summary);
      })
      .catch((error: Error) => {
        if (!active) {
          return;
        }

        setStatus(error.message || "Could not load credit summary.");
      });

    const initialCloseDate = new Date().toISOString().slice(0, 10);

    void fetchJson<DailyClose>(`/invoices/daily-close?date=${initialCloseDate}`)
      .then((close) => {
        if (!active) {
          return;
        }

        setDailyClose(close);
      })
      .catch((error: Error) => {
        if (!active) {
          return;
        }

        setStatus(error.message || "Could not load daily close.");
      });

    const start = new Date();
    start.setDate(start.getDate() - 29);
    const from = start.toISOString().slice(0, 10);
    const to = new Date().toISOString().slice(0, 10);

    void fetchJson<HistoricReport>(`/invoices/historic-report?from=${from}&to=${to}`)
      .then((report) => {
        if (!active) {
          return;
        }

        setHistoric(report);
      })
      .catch((error: Error) => {
        if (!active) {
          return;
        }

        setStatus(error.message || "Could not load historic report.");
      })
      .finally(() => {
        if (active) {
          setHistoricLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="space-y-6">
      <section className="panel p-6 md:p-8">
        <p className="soft-label">Business Reports</p>
        <h1 className="mt-2 text-3xl font-black tracking-tight text-slate-950">
          Compare sales, expenses, and profit
        </h1>
        <p className="mt-2 max-w-2xl text-base leading-7 text-slate-600">
          Switch between daily, weekly, monthly, and yearly snapshots to see how
          revenue and operating costs are moving.
        </p>
      </section>

      <section className="panel p-6 md:p-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="soft-label">Historic Report</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
              Everything in one place
            </h2>
            <p className="mt-2 max-w-2xl text-sm font-medium leading-6 text-slate-600">
              Pick any range to review invoices, collections, expenses, purchases,
              stock movement, top customers, and top products together.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-[auto_auto_auto]">
            <input
              className="field sm:w-44"
              type="date"
              value={historicFrom}
              onChange={(event) => setHistoricFrom(event.target.value)}
            />
            <input
              className="field sm:w-44"
              type="date"
              value={historicTo}
              onChange={(event) => setHistoricTo(event.target.value)}
            />
            <button
              className="btn-secondary"
              onClick={() => loadHistoric()}
              disabled={historicLoading}
            >
              Load History
            </button>
          </div>
        </div>

        {historicLoading ? (
          <div className="mt-6 rounded-3xl bg-slate-50 px-5 py-8 text-sm font-medium text-slate-600">
            Loading historic report...
          </div>
        ) : null}

        {historic ? (
          <>
            <div className="mt-5 flex flex-wrap gap-3">
              <button className="btn-primary" onClick={() => exportHistoricCsv(historic)}>
                Export CSV
              </button>
              <button className="btn-secondary" onClick={() => window.print()}>
                Print Report
              </button>
              <div className="status-pill bg-black/5 text-slate-700">
                {historic.range.from} to {historic.range.to}
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <CloseCard label="Sales" value={historic.totals.salesTotal} tone="green" />
              <CloseCard label="Collections" value={historic.totals.netCollection} tone="blue" />
              <CloseCard label="Expenses" value={historic.totals.expenseTotal} tone="red" />
              <CloseCard label="Profit" value={historic.totals.grossProfit} tone="amber" />
              <CloseCard label="Purchases" value={historic.totals.purchaseTotal} tone="slate" />
              <CloseCard label="Cash" value={historic.totals.cashCollection} tone="dark" />
              <CloseCard label="KNET" value={historic.totals.knetCollection} tone="slate" />
              <CountCard label="Invoices" value={historic.totals.invoiceCount} />
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              <CountCard label="Stock In kg" value={historic.totals.stockInKg.toFixed(3)} />
              <CountCard label="Stock Out kg" value={historic.totals.stockOutKg.toFixed(3)} />
              <CountCard label="Wastage kg" value={historic.totals.wastageKg.toFixed(3)} />
            </div>

            <div className="mt-6 grid gap-5 xl:grid-cols-2">
              <HistoricMoneyList
                title={`Invoices (${historic.totals.invoiceCount})`}
                empty="No invoices in this range."
                rows={historic.invoices.map((invoice) => ({
                  id: invoice.id,
                  primary: `${invoice.invoice_number} · ${invoice.customer_name}`,
                  secondary: `${invoice.type} · ${new Date(invoice.date).toLocaleDateString()}`,
                  amount: invoice.total,
                }))}
              />
              <HistoricMoneyList
                title={`Payments (${historic.totals.paymentCount})`}
                empty="No payments in this range."
                rows={historic.payments.map((payment) => ({
                  id: payment.id,
                  primary: payment.customer_name,
                  secondary: `${payment.mode} · ${new Date(payment.date).toLocaleDateString()}`,
                  amount: payment.amount,
                }))}
              />
              <HistoricMoneyList
                title={`Purchases (${historic.totals.purchaseCount})`}
                empty="No purchases in this range."
                rows={historic.purchases.map((purchase) => ({
                  id: purchase.id,
                  primary: purchase.supplier_name,
                  secondary: `${purchase.invoice_no || "No invoice no"} · ${new Date(purchase.date).toLocaleDateString()}`,
                  amount: purchase.total,
                }))}
              />
              <HistoricMoneyList
                title={`Expenses (${historic.totals.expenseCount})`}
                empty="No expenses in this range."
                rows={historic.expenses.map((expense) => ({
                  id: expense.id,
                  primary: expense.title,
                  secondary: `${expense.category} · ${new Date(expense.date).toLocaleDateString()}`,
                  amount: expense.amount,
                }))}
              />
            </div>

            <div className="mt-6 grid gap-5 xl:grid-cols-3">
              <HistoricTextList
                title={`Stock Movements (${historic.totals.stockMovementCount})`}
                empty="No stock movement in this range."
                rows={historic.stockMovements.map((movement) => ({
                  id: movement.id,
                  primary: movement.product_name,
                  secondary: `${movement.type} · ${new Date(movement.date).toLocaleDateString()}`,
                  right: `${movement.quantity_kg.toFixed(3)} kg`,
                }))}
              />
              <HistoricTextList
                title="Top Customers"
                empty="No customer activity in this range."
                rows={historic.topCustomers.map((customer) => ({
                  id: customer.id,
                  primary: customer.name,
                  secondary: `${customer.invoiceCount} invoices · collected ${customer.collected.toFixed(3)}`,
                  right: customer.sales.toFixed(3),
                }))}
              />
              <HistoricTextList
                title="Top Products"
                empty="No product activity in this range."
                rows={historic.topProducts.map((product) => ({
                  id: product.id,
                  primary: product.name,
                  secondary: `Purchased ${product.purchasedKg.toFixed(3)} kg · Stock ${product.currentStockKg.toFixed(3)} kg`,
                  right: `${product.soldKg.toFixed(3)} kg sold`,
                }))}
              />
            </div>
          </>
        ) : null}
      </section>

      <section className="panel p-6 md:p-8">
        <div className="flex flex-wrap gap-3">
          {reportOptions.map((option) => {
            const active = option.value === type;

            return (
              <button
                key={option.value}
                className={
                  active
                    ? "rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white"
                    : "rounded-2xl border border-black/10 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-black/20 hover:bg-slate-50"
                }
                onClick={() => load(option.value)}
                disabled={loading && active}
              >
                {option.label}
              </button>
            );
          })}
        </div>

        {status ? (
          <div className="mt-5 rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {status}
          </div>
        ) : null}

        {loading ? (
          <div className="mt-6 rounded-3xl bg-slate-50 px-5 py-8 text-sm font-medium text-slate-600">
            Loading report...
          </div>
        ) : null}

        {data ? (
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <div className="rounded-3xl bg-emerald-50 px-5 py-5">
              <p className="soft-label text-emerald-700">{reportOptions.find((item) => item.value === data.type)?.caption} sales</p>
              <p className="mt-2 text-3xl font-black tracking-tight text-emerald-700">
                <Money value={data.sales} />
              </p>
            </div>

            <div className="rounded-3xl bg-red-50 px-5 py-5">
              <p className="soft-label text-red-700">{reportOptions.find((item) => item.value === data.type)?.caption} expenses</p>
              <p className="mt-2 text-3xl font-black tracking-tight text-red-600">
                <Money value={data.expenses} />
              </p>
            </div>

            <div className="rounded-3xl bg-amber-50 px-5 py-5">
              <p className="soft-label text-amber-700">{reportOptions.find((item) => item.value === data.type)?.caption} profit</p>
              <p className="mt-2 text-3xl font-black tracking-tight text-amber-700">
                <Money value={data.profit} />
              </p>
            </div>
          </div>
        ) : null}
      </section>

      <section className="panel p-6 md:p-8">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="soft-label">Daily Closing</p>
            <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
              Cashier close summary
            </h2>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <input
              className="field sm:w-44"
              type="date"
              value={closeDate}
              onChange={(event) => setCloseDate(event.target.value)}
            />
            <button className="btn-secondary" onClick={() => loadDailyClose(closeDate)}>
              Load Day
            </button>
          </div>
        </div>

        {dailyClose ? (
          <>
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <CloseCard label="Sales" value={dailyClose.totals.salesTotal} tone="green" />
              <CloseCard label="Collections" value={dailyClose.totals.collectionTotal} tone="blue" />
              <CloseCard label="Reversals" value={dailyClose.totals.reversalTotal ?? 0} tone="red" />
              <CloseCard label="Net Collection" value={dailyClose.totals.netCollection ?? dailyClose.totals.collectionTotal} tone="dark" />
              <CloseCard label="Expenses" value={dailyClose.totals.expenseTotal} tone="red" />
              <CloseCard label="Net Cash" value={dailyClose.totals.netCash} tone="dark" />
              <CloseCard label="Cash Collected" value={dailyClose.totals.cashCollection} tone="slate" />
              <CloseCard label="KNET Collected" value={dailyClose.totals.knetCollection} tone="slate" />
              <CloseCard label="Profit Estimate" value={dailyClose.totals.profitEstimate} tone="amber" />
              <CloseCard label="Credit Movement" value={dailyClose.totals.creditMovement} tone="amber" />
            </div>

            <div className="mt-6 grid gap-5 xl:grid-cols-4">
              <CloseList
                title={`Invoices (${dailyClose.totals.invoiceCount})`}
                empty="No invoices for this day."
                rows={dailyClose.invoices.map((invoice) => ({
                  id: invoice.id,
                  primary: invoice.customer_name,
                  secondary: invoice.type,
                  amount: invoice.total,
                }))}
              />
              <CloseList
                title={`Payments (${dailyClose.totals.paymentCount})`}
                empty="No payments for this day."
                rows={dailyClose.payments.map((payment) => ({
                  id: payment.id,
                  primary: payment.customer_name,
                  secondary: payment.mode,
                  amount: payment.amount,
                }))}
              />
              <CloseList
                title={`Expenses (${dailyClose.totals.expenseCount})`}
                empty="No expenses for this day."
                rows={dailyClose.expenses.map((expense) => ({
                  id: expense.id,
                  primary: expense.title,
                  secondary: expense.category,
                  amount: expense.amount,
                }))}
              />
              <CloseList
                title={`Reversals (${dailyClose.totals.reversalCount ?? 0})`}
                empty="No reversals for this day."
                rows={(dailyClose.reversals ?? []).map((payment) => ({
                  id: payment.id,
                  primary: payment.customer_name,
                  secondary: payment.mode,
                  amount: payment.amount,
                }))}
              />
            </div>
          </>
        ) : (
          <div className="mt-6 rounded-3xl bg-slate-50 px-5 py-8 text-sm font-medium text-slate-600">
            Loading daily close...
          </div>
        )}
      </section>

      {creditSummary ? (
        <section className="panel p-6 md:p-8">
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="soft-label">Collections</p>
              <h2 className="mt-2 text-2xl font-black tracking-tight text-slate-950">
                Credit exposure and collection priority
              </h2>
            </div>
            <div className="status-pill bg-black/5 text-slate-700">
              {creditSummary.totals.dueCustomerCount} due customers
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-4">
            <div className="rounded-3xl bg-slate-50 px-5 py-5">
              <p className="soft-label">Outstanding</p>
              <p className="mt-2 text-3xl font-black text-slate-950">
                <Money value={creditSummary.totals.totalOutstanding} />
              </p>
            </div>
            <div className="rounded-3xl bg-red-50 px-5 py-5">
              <p className="soft-label text-red-700">Over Limit</p>
              <p className="mt-2 text-3xl font-black text-red-700">
                {creditSummary.totals.overLimitCount}
              </p>
            </div>
            <div className="rounded-3xl bg-amber-50 px-5 py-5">
              <p className="soft-label text-amber-700">Near Limit</p>
              <p className="mt-2 text-3xl font-black text-amber-700">
                {creditSummary.totals.nearLimitCount}
              </p>
            </div>
            <div className="rounded-3xl bg-emerald-50 px-5 py-5">
              <p className="soft-label text-emerald-700">Customers</p>
              <p className="mt-2 text-3xl font-black text-emerald-700">
                {creditSummary.totals.customerCount}
              </p>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-3xl border border-black/8">
            <div className="grid grid-cols-[1.3fr_0.8fr_0.8fr_0.8fr] gap-3 bg-slate-100 px-4 py-3 text-xs font-bold uppercase tracking-[0.14em] text-slate-600">
              <div>Customer</div>
              <div>Balance</div>
              <div>Limit</div>
              <div>Status</div>
            </div>
            {creditSummary.customers.slice(0, 12).map((customer) => (
              <div
                key={customer.id}
                className="grid grid-cols-[1.3fr_0.8fr_0.8fr_0.8fr] gap-3 border-t border-black/6 bg-white px-4 py-3 text-sm"
              >
                <div>
                  <p className="font-bold text-slate-950">{customer.name}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    {customer.mobile || "No mobile"}
                  </p>
                </div>
                <div className="font-black text-slate-950">
                  <Money value={customer.balance} />
                </div>
                <div className="font-semibold text-slate-700">
                  {Number(customer.credit_limit) > 0
                    ? <Money value={customer.credit_limit} />
                    : "Unlimited"}
                </div>
                <div>
                  <span
                    className={[
                      "status-pill",
                      customer.status === "over_limit"
                        ? "bg-red-100 text-red-700"
                        : customer.status === "near_limit"
                          ? "bg-amber-100 text-amber-700"
                          : customer.status === "due"
                            ? "bg-slate-100 text-slate-700"
                            : "bg-emerald-100 text-emerald-700",
                    ].join(" ")}
                  >
                    {customer.status.replace("_", " ")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function CloseCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: "green" | "blue" | "red" | "dark" | "slate" | "amber";
}) {
  const classes = {
    green: "bg-emerald-50 text-emerald-800",
    blue: "bg-blue-50 text-blue-800",
    red: "bg-red-50 text-red-800",
    dark: "bg-slate-950 text-white",
    slate: "bg-slate-50 text-slate-800",
    amber: "bg-amber-50 text-amber-800",
  };

  return (
    <div className={`rounded-3xl px-5 py-5 [container-type:inline-size] ${classes[tone]}`}>
      <p className="text-xs font-bold uppercase tracking-[0.14em] opacity-70">{label}</p>
      <p className="mt-2 max-w-full text-[clamp(1.75rem,12cqw,2.7rem)] font-black leading-none tracking-normal"><Money value={value} /></p>
    </div>
  );
}

function CountCard({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-3xl bg-slate-50 px-5 py-5 text-slate-800">
      <p className="text-xs font-bold uppercase tracking-[0.14em] opacity-70">{label}</p>
      <p className="mt-2 text-3xl font-black">{value}</p>
    </div>
  );
}

function HistoricMoneyList({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: Array<{ id: number; primary: string; secondary: string; amount: number }>;
}) {
  return (
    <div className="rounded-3xl border border-black/8 bg-white p-5">
      <h3 className="text-lg font-bold text-slate-950">{title}</h3>
      <div className="mt-4 max-h-[420px] space-y-2 overflow-auto pr-1">
        {rows.length ? (
          rows.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-[1fr_auto] gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-bold text-slate-950">{row.primary}</p>
                <p className="mt-1 truncate text-xs capitalize text-slate-500">{row.secondary}</p>
              </div>
              <p className="text-right font-black text-slate-950"><Money value={row.amount} /></p>
            </div>
          ))
        ) : (
          <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-600">
            {empty}
          </div>
        )}
      </div>
    </div>
  );
}

function HistoricTextList({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: Array<{ id: number; primary: string; secondary: string; right: string }>;
}) {
  return (
    <div className="rounded-3xl border border-black/8 bg-white p-5">
      <h3 className="text-lg font-bold text-slate-950">{title}</h3>
      <div className="mt-4 max-h-[420px] space-y-2 overflow-auto pr-1">
        {rows.length ? (
          rows.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-[1fr_auto] gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm"
            >
              <div className="min-w-0">
                <p className="truncate font-bold text-slate-950">{row.primary}</p>
                <p className="mt-1 truncate text-xs capitalize text-slate-500">{row.secondary}</p>
              </div>
              <p className="max-w-32 text-right text-sm font-black text-slate-950">{row.right}</p>
            </div>
          ))
        ) : (
          <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-600">
            {empty}
          </div>
        )}
      </div>
    </div>
  );
}

function CloseList({
  title,
  empty,
  rows,
}: {
  title: string;
  empty: string;
  rows: Array<{ id: number; primary: string; secondary: string; amount: number }>;
}) {
  return (
    <div className="rounded-3xl border border-black/8 bg-white p-5">
      <h3 className="text-lg font-bold text-slate-950">{title}</h3>
      <div className="mt-4 space-y-2">
        {rows.length ? (
          rows.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-[1fr_auto] gap-3 rounded-2xl bg-slate-50 px-4 py-3 text-sm"
            >
              <div>
                <p className="font-bold text-slate-950">{row.primary}</p>
                <p className="mt-1 text-xs capitalize text-slate-500">{row.secondary}</p>
              </div>
              <p className="font-black text-slate-950"><Money value={row.amount} /></p>
            </div>
          ))
        ) : (
          <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm font-semibold text-slate-600">
            {empty}
          </div>
        )}
      </div>
    </div>
  );
}
