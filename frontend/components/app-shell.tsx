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
    label: "Overview",
    roles: ["admin"],
    items: [{ href: "/dashboard", label: "Dashboard" }],
  },
  {
    label: "Front Counter",
    roles: ["admin", "staff"],
    items: [
      { href: "/invoice", label: "POS Billing" },
      { href: "/invoices", label: "Invoice History" },
      { href: "/customers", label: "Customers" },
    ],
  },
  {
    label: "Stock & Buying",
    roles: ["admin", "staff"],
    items: [
      { href: "/inventory", label: "Stock Lookup" },
      { href: "/purchases", label: "Purchase Entry", roles: ["admin"] },
      { href: "/suppliers", label: "Suppliers", roles: ["admin"] },
    ],
  },
  {
    label: "Finance",
    roles: ["admin", "staff"],
    items: [
      { href: "/payment", label: "Collections" },
      { href: "/shift-close", label: "Shift Close" },
      { href: "/knet", label: "KNET Reconcile", roles: ["admin"] },
      { href: "/statement", label: "Customer Ledger" },
      { href: "/expenses", label: "Expenses", roles: ["admin"] },
    ],
  },
  {
    label: "Reports",
    roles: ["admin"],
    items: [
      { href: "/reports", label: "Business Reports" },
      { href: "/activity", label: "Staff Activity" },
    ],
  },
] satisfies NavGroup[];

type NavItem = {
  href: string;
  label: string;
  roles?: UserRole[];
};

type NavGroup = {
  label: string;
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
  const [language, setLanguage] = useState<Language>("en");

  const authUser = authState?.authUser ?? null;
  const validToken = authState?.validToken ?? false;
  const t = (text: string) => translate(language, text);

  useEffect(() => {
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
  }, [authState, authUser?.role, isLoginPage, pathname, router, validToken]);

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
          roles: ["admin"],
          items: [
            { href: "/system", label: "System Readiness" },
            { href: "/users", label: "Users & Roles" },
          ],
        },
      ]);
    }

    return filterGroups(baseNavGroups);
  }, [authUser?.role]);

  if (!authState || (isLoginPage && validToken) || (!isLoginPage && !validToken)) {
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
      <aside className="border-b border-white/10 bg-[linear-gradient(180deg,#191919_0%,#111111_68%,#2b1113_100%)] px-5 py-6 text-white lg:sticky lg:top-0 lg:h-screen lg:w-76 lg:overflow-y-auto lg:border-b-0 lg:border-r">
        <Link href="/dashboard" className="mb-5 block">
          <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
            <div className="flex items-center gap-3">
              <Image
                src="/falcon.svg"
                alt="Meatena falcon"
                width={58}
                height={58}
                className="h-14 w-14 rounded-2xl"
                priority
              />
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.24em] text-white/45">
                  {t("Meatena")}
                </p>
                <p className="truncate text-lg font-black text-white">
                  {t("Butchery Operations")}
                </p>
              </div>
            </div>
          </div>
        </Link>

        <div className="mb-4 rounded-xl border border-white/10 bg-white/6 p-3">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-white/45">
            {t("Logged In")}
          </p>
          <p className="mt-1.5 text-base font-semibold">{authUser?.username ?? "Unknown user"}</p>
          <p className="mt-1 text-xs uppercase tracking-[0.16em] text-white/65">
            {authUser?.role ?? "staff"}
          </p>
        </div>

        <BackendHealthStatus language={language} />

        <button
          type="button"
          className="mb-4 w-full rounded-xl border border-white/10 bg-white/6 px-4 py-3 text-sm font-bold text-white transition hover:bg-white/12"
          onClick={() => changeLanguage(language === "en" ? "ar" : "en")}
        >
          {language === "en" ? "عربي" : "EN"}
        </button>

        <nav className="space-y-3">
          {navGroups.map((group) => (
            <div key={group.label}>
              <p className="mb-1.5 px-3 text-[0.64rem] font-bold uppercase tracking-[0.16em] text-white/38">
                {t(group.label)}
              </p>
              <div className="space-y-0.5">
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
                        "block rounded-lg border px-3 py-2 text-sm font-semibold transition",
                        isActive
                          ? "border-primary/45 bg-primary/18 text-white shadow-sm"
                          : "border-transparent text-white/72 hover:bg-white/8 hover:text-white",
                      ].join(" ")}
                    >
                      {t(item.label)}
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
