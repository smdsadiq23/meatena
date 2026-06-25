"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import {
  API,
  clearToken,
  getToken,
  getAuthUser,
  getHomePathForRole,
  hasValidToken,
  type AuthUser,
  type UserRole,
} from "../lib/auth";
import { loadCurrencyRate } from "../lib/currency";
import { ARABIC_LABELS, type Language, translate } from "../lib/i18n";

const baseNavGroups = [
  {
    label: "Today",
    roles: ["admin"],
    purpose: "Daily control room",
    items: [{ href: "/dashboard", label: "Daily Dashboard", hint: "Sales, cash, stock alerts" }],
  },
  {
    label: "Sell",
    roles: ["admin", "staff"],
    purpose: "Customer billing",
    items: [
      { href: "/invoice", label: "Create Invoice", hint: "Counter billing" },
      { href: "/payment", label: "Collect Payment", hint: "Cash, KNET, card links" },
      { href: "/invoices", label: "Invoice History", hint: "PDFs and receipts" },
    ],
  },
  {
    label: "Buy & Stock",
    roles: ["admin", "staff"],
    purpose: "Purchases and stock",
    items: [
      { href: "/purchases", label: "Receive Purchase", hint: "Supplier bill, stock inward", roles: ["admin"] },
      { href: "/inventory", label: "Stock Control", hint: "Pieces, kg, price, movements" },
      { href: "/expenses", label: "Shipment Expenses", hint: "Landing and operating costs", roles: ["admin"] },
    ],
  },
  {
    label: "People & Money",
    roles: ["admin", "staff"],
    purpose: "Ledgers and balances",
    items: [
      { href: "/customers", label: "Customers", hint: "Credit and statements" },
      { href: "/suppliers", label: "Suppliers", hint: "Payables and advances", roles: ["admin"] },
      { href: "/statement", label: "Customer Ledger", hint: "Balances and PDF" },
      { href: "/shift-close", label: "Shift Close", hint: "End of day cash check" },
    ],
  },
  {
    label: "Reports",
    roles: ["admin"],
    purpose: "Owner view",
    items: [
      { href: "/reports", label: "Business Reports", hint: "Profit, shipments, history" },
      { href: "/knet", label: "Payment Reconcile", hint: "KNET status", roles: ["admin"] },
      { href: "/activity", label: "Staff Activity", hint: "Audit trail" },
    ],
  },
] satisfies NavGroup[];

type NavItem = {
  href: string;
  label: string;
  hint?: string;
  roles?: UserRole[];
};

type NavGroup = {
  label: string;
  purpose?: string;
  roles?: UserRole[];
  items: NavItem[];
};

const routeRoles: { href: string; roles: UserRole[] }[] = [
  { href: "/dashboard", roles: ["admin"] },
  { href: "/purchases", roles: ["admin"] },
  { href: "/suppliers", roles: ["admin"] },
  { href: "/knet", roles: ["admin"] },
  { href: "/expenses", roles: ["admin"] },
  { href: "/reports", roles: ["admin"] },
  { href: "/activity", roles: ["admin"] },
  { href: "/users", roles: ["admin"] },
  { href: "/system", roles: ["admin"] },
  { href: "/invoice", roles: ["admin", "staff"] },
  { href: "/invoices", roles: ["admin", "staff"] },
  { href: "/customers", roles: ["admin", "staff"] },
  { href: "/inventory", roles: ["admin", "staff"] },
  { href: "/payment", roles: ["admin", "staff"] },
  { href: "/shift-close", roles: ["admin", "staff"] },
  { href: "/statement", roles: ["admin", "staff"] },
];

function canAccess(roles: UserRole[] | undefined, userRole?: UserRole) {
  return !roles || Boolean(userRole && roles.includes(userRole));
}

function getRequiredRolesForPath(pathname: string) {
  return routeRoles.find(
    (route) => pathname === route.href || pathname.startsWith(`${route.href}/`)
  )?.roles;
}

function translatePageText(root: HTMLElement, language: Language) {
  const arabicToEnglish = new Map(
    Object.entries(ARABIC_LABELS).map(([english, arabic]) => [arabic, english])
  );
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];

  while (walker.nextNode()) {
    textNodes.push(walker.currentNode as Text);
  }

  textNodes.forEach((node) => {
    const parent = node.parentElement;
    const raw = node.textContent ?? "";
    const trimmed = raw.trim();

    if (!parent || !trimmed || ["SCRIPT", "STYLE", "TEXTAREA"].includes(parent.tagName)) {
      return;
    }

    const translated =
      language === "ar"
        ? ARABIC_LABELS[trimmed]
        : arabicToEnglish.get(trimmed);

    if (!translated || translated === trimmed) {
      return;
    }

    node.textContent = raw.replace(trimmed, translated);
  });

  root
    .querySelectorAll<HTMLInputElement | HTMLTextAreaElement>(
      "input[placeholder], textarea[placeholder]"
    )
    .forEach((field) => {
      const translated =
        language === "ar"
          ? ARABIC_LABELS[field.placeholder]
          : arabicToEnglish.get(field.placeholder);
      if (field.placeholder !== translated) {
        field.placeholder = translated ?? field.placeholder;
      }
    });

  root.querySelectorAll<HTMLElement>("[aria-label]").forEach((element) => {
    const label = element.getAttribute("aria-label") ?? "";
    const translated =
      language === "ar" ? ARABIC_LABELS[label] : arabicToEnglish.get(label);
    if (translated && label !== translated) {
      element.setAttribute("aria-label", translated);
    }
  });
}

type AuthState = {
  authUser: AuthUser | null;
  validToken: boolean;
};

type HealthState = {
  status: "ok" | "degraded";
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

const EMPTY_AUTH_STATE: AuthState = {
  authUser: null,
  validToken: false,
};
let cachedToken: string | null | undefined;
let cachedAuthSnapshot: AuthState | null = null;

function subscribeToAuthState(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener("auth-change", callback);

  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener("auth-change", callback);
  };
}

function getAuthSnapshot(): AuthState {
  const token = getToken();

  if (token === cachedToken && cachedAuthSnapshot) {
    return cachedAuthSnapshot;
  }

  cachedToken = token;
  cachedAuthSnapshot = {
    authUser: getAuthUser(),
    validToken: hasValidToken(),
  };

  return cachedAuthSnapshot;
}

function BackendHealthStatus({ language }: { language: Language }) {
  const [health, setHealth] = useState<HealthState | null>(null);
  const t = (text: string) => translate(language, text);
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    let active = true;

    async function loadHealth() {
      try {
        const response = await fetch(`${API}/health`, { cache: "no-store" });

        if (!response.ok) {
          throw new Error(`Health check failed with ${response.status}`);
        }

        const data = (await response.json()) as HealthState;

        if (active) {
          setHealth(data);
          setOffline(false);
        }
      } catch {
        if (active) {
          setHealth(null);
          setOffline(true);
        }
      }
    }

    void loadHealth();
    const interval = window.setInterval(loadHealth, 30000);

    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const databaseReady = health?.dependencies.database.status === "ok";
  const knetReady = health?.dependencies.knet.status === "configured";
  const stateLabel = offline
    ? "Backend offline"
    : health?.status === "ok"
      ? "System ready"
      : "Needs setup";
  const dotClass = offline
    ? "bg-red-500"
    : databaseReady
      ? "bg-emerald-400"
      : "bg-amber-400";

  return (
    <div className="mb-4 rounded-xl border border-white/10 bg-white/6 p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-white/45">
          {t("System")}
        </span>
        <span className="inline-flex items-center gap-2 rounded-full bg-black/20 px-2.5 py-1 text-[0.7rem] font-bold text-white/75">
          <span className={`h-2 w-2 rounded-full ${dotClass}`} />
          {t(stateLabel)}
        </span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold text-white/70">
        <div className="rounded-lg bg-black/18 px-2.5 py-2">
          DB: {t(databaseReady ? "Online" : "Check")}
        </div>
        <div className="rounded-lg bg-black/18 px-2.5 py-2">
          KNET: {t(knetReady ? "Live" : "Mock")}
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const contentRef = useRef<HTMLDivElement>(null);
  const isLoginPage = pathname === "/login";
  const authState = useSyncExternalStore(subscribeToAuthState, getAuthSnapshot, () => EMPTY_AUTH_STATE);
  const [authReady, setAuthReady] = useState(false);
  const [language, setLanguage] = useState<Language>("en");

  const authUser = authState?.authUser ?? null;
  const validToken = authState?.validToken ?? false;
  const t = (text: string) => translate(language, text);

  useEffect(() => {
    setAuthReady(true);

    const storedLanguage = window.localStorage.getItem("language");
    if (storedLanguage === "ar" || storedLanguage === "en") {
      setLanguage(storedLanguage);
      document.documentElement.lang = storedLanguage;
      document.documentElement.dir = storedLanguage === "ar" ? "rtl" : "ltr";
    }
  }, []);

  useEffect(() => {
    void loadCurrencyRate();
  }, []);

  function changeLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    window.localStorage.setItem("language", nextLanguage);
    document.documentElement.lang = nextLanguage;
    document.documentElement.dir = nextLanguage === "ar" ? "rtl" : "ltr";
    window.dispatchEvent(new Event("language-change"));
  }

  useEffect(() => {
    const root = contentRef.current;

    if (!root || isLoginPage) {
      return;
    }

    const translateCurrentPage = () => translatePageText(root, language);

    const frame = window.requestAnimationFrame(translateCurrentPage);
    const observer = new MutationObserver(() => {
      window.requestAnimationFrame(translateCurrentPage);
    });

    observer.observe(root, {
      childList: true,
      subtree: true,
      characterData: true,
      attributes: true,
      attributeFilter: ["placeholder", "aria-label"],
    });

    return () => {
      window.cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [isLoginPage, language, pathname]);

  useEffect(() => {
    if (!authReady) {
      return;
    }

    if (!authState) {
      return;
    }

    if (isLoginPage) {
      if (validToken) {
        router.replace("/dashboard");
      }
      return;
    }

    if (!validToken) {
      clearToken();
      router.replace("/login");
      return;
    }

    const requiredRoles = getRequiredRolesForPath(pathname);

    if (!canAccess(requiredRoles, authUser?.role)) {
      router.replace(getHomePathForRole(authUser?.role));
    }
  }, [authReady, authState, authUser?.role, isLoginPage, pathname, router, validToken]);

  const navGroups = useMemo(() => {
    const filterGroups = (groups: NavGroup[]) =>
      groups
        .filter((group) => canAccess(group.roles, authUser?.role))
        .map((group) => ({
          ...group,
          items: group.items.filter((item) => canAccess(item.roles, authUser?.role)),
        }))
        .filter((group) => group.items.length > 0);

    if (authUser?.role === "admin") {
      return filterGroups([
        ...baseNavGroups,
        {
          label: "Admin",
          purpose: "Setup",
          roles: ["admin"],
          items: [
            { href: "/system", label: "System Readiness", hint: "Backend, KNET, settings" },
            { href: "/users", label: "Users & Roles", hint: "Staff access" },
          ],
        },
      ]);
    }

    return filterGroups(baseNavGroups);
  }, [authUser?.role]);

  if (!authReady || !authState || (isLoginPage && validToken) || (!isLoginPage && !validToken)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background px-6 text-center text-sm font-semibold text-slate-600">
        {t("Loading secure workspace...")}
      </div>
    );
  }

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen lg:flex">
      <aside className="border-b border-white/10 bg-[linear-gradient(180deg,#191919_0%,#111111_68%,#2b1113_100%)] px-4 py-5 text-white lg:sticky lg:top-0 lg:h-screen lg:w-82 lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <Link href="/dashboard" className="mb-4 block">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <Image
              src="/logo.png"
              alt="Meatena logo"
              width={520}
              height={320}
              className="h-auto w-full object-contain"
              priority
            />
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.14em] text-white/50">
              {t("ERP command center")}
            </p>
          </div>
        </Link>

        <div className="mb-3 grid grid-cols-[1fr_auto] gap-2 rounded-xl border border-white/10 bg-white/6 p-3">
          <div>
            <p className="text-[0.65rem] font-semibold uppercase tracking-[0.22em] text-white/45">
              {t("Logged In")}
            </p>
            <p className="mt-1 text-base font-semibold">{authUser?.username ?? "Unknown user"}</p>
          </div>
          <div className="self-start rounded-full border border-primary/40 bg-primary/15 px-3 py-1 text-xs font-black uppercase tracking-[0.12em] text-white">
            {authUser?.role ?? "staff"}
          </div>
        </div>

        <BackendHealthStatus language={language} />

        <button
          type="button"
          className="mb-4 w-full rounded-xl border border-white/10 bg-white/6 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/12"
          onClick={() => changeLanguage(language === "en" ? "ar" : "en")}
        >
          {language === "en" ? "عربي" : "EN"}
        </button>

        <nav className="space-y-2.5">
          {navGroups.map((group) => (
            <div key={group.label}>
              <div className="mb-1.5 flex items-end justify-between gap-3 px-2">
                <p className="text-[0.64rem] font-black uppercase tracking-[0.18em] text-white/45">
                  {t(group.label)}
                </p>
                {group.purpose ? (
                  <p className="truncate text-[0.64rem] font-semibold text-white/30">
                    {t(group.purpose)}
                  </p>
                ) : null}
              </div>
              <div className="grid gap-1">
                {group.items.map((item) => {
                  const isActive =
                    pathname === item.href ||
                    (item.href !== "/dashboard" && pathname.startsWith(`${item.href}/`));

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={[
                        "block rounded-xl border px-3 py-2.5 transition",
                        isActive
                          ? "border-primary/55 bg-primary/20 text-white shadow-sm"
                          : "border-white/5 bg-white/[0.03] text-white/78 hover:bg-white/8 hover:text-white",
                      ].join(" ")}
                    >
                      <span className="block text-sm font-black">{t(item.label)}</span>
                      {item.hint ? (
                        <span className="mt-0.5 block truncate text-[0.68rem] font-semibold text-white/42">
                          {t(item.hint)}
                        </span>
                      ) : null}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>

        <button
          className="mt-6 w-full rounded-xl border border-white/10 bg-white/6 px-4 py-3 text-sm font-semibold text-white transition hover:bg-white/12"
          onClick={() => {
            clearToken();
            window.dispatchEvent(new Event("auth-change"));
            router.replace("/login");
          }}
        >
          {t("Logout")}
        </button>
      </aside>

      <main ref={contentRef} className="min-w-0 flex-1 p-4 md:p-6 lg:p-8">
        <div className="mx-auto max-w-7xl">{children}</div>
      </main>
    </div>
  );
}
