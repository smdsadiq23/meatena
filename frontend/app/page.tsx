import Link from "next/link";

export default function Home() {
  return (
    <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
      <section className="panel overflow-hidden p-8 lg:p-10">
        <div className="status-pill bg-red-50 text-red-700">Meatena Control Center</div>
        <h1 className="mt-5 max-w-xl text-4xl font-black tracking-tight text-slate-950 md:text-5xl">
          Branded billing software for fast meat shop operations.
        </h1>
        <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-600">
          Create invoices faster, collect payments on time, and keep customer
          balances visible for the whole team.
        </p>

        <div className="mt-8 flex flex-wrap gap-3">
          <Link href="/invoice" className="btn-primary">
            Start Billing
          </Link>
          <Link href="/dashboard" className="btn-secondary">
            Open Dashboard
          </Link>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {[
            ["Invoices", "Multi-item billing with PDF output"],
            ["Payments", "Live balance reduction and ledger sync"],
            ["Statements", "Customer history with running balance"],
          ].map(([title, text]) => (
            <div key={title} className="rounded-3xl bg-black/3 p-5">
              <p className="text-lg font-bold text-slate-900">{title}</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="panel p-8">
        <p className="soft-label">Quick Access</p>
        <div className="mt-4 grid gap-3">
          {[
            ["/dashboard", "Dashboard", "Today sales, collection, and outstanding"],
            ["/customers", "Customers", "Search and create customer records"],
            ["/invoice", "Billing", "Fast counter billing with live total"],
            ["/payment", "Payments", "Receive payment and reduce balance"],
            ["/invoices", "Invoices", "History and PDF downloads"],
            ["/statement", "Statement", "Ledger view for each customer"],
          ].map(([href, title, text]) => (
            <Link
              key={href}
              href={href}
              className="rounded-3xl border border-black/8 bg-white p-5 transition hover:-translate-y-0.5 hover:border-red-200 hover:shadow-lg"
            >
              <p className="text-lg font-bold text-slate-950">{title}</p>
              <p className="mt-1 text-sm text-slate-600">{text}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
