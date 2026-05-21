"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { API, getHomePathForRole, parseToken, setToken } from "../../lib/auth";
import { type Language, translate } from "../../lib/i18n";

type LoginResponse = {
  access_token?: string;
};

export default function LoginPage() {
  const router = useRouter();
  const [language, setLanguage] = useState<Language>("en");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const t = (text: string) => translate(language, text);

  useEffect(() => {
    const stored = window.localStorage.getItem("language");
    const nextLanguage = stored === "ar" ? "ar" : "en";
    setLanguage(nextLanguage);
    document.documentElement.lang = nextLanguage;
    document.documentElement.dir = nextLanguage === "ar" ? "rtl" : "ltr";
  }, []);

  function changeLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    window.localStorage.setItem("language", nextLanguage);
    document.documentElement.lang = nextLanguage;
    document.documentElement.dir = nextLanguage === "ar" ? "rtl" : "ltr";
    window.dispatchEvent(new Event("language-change"));
  }

  const login = async () => {
    if (!username.trim() || !password.trim()) {
      setError(t("Enter both username and password."));
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch(`${API}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ username: username.trim(), password }),
      });

      const data = (await res.json()) as LoginResponse & { message?: string };

      if (!res.ok || !data.access_token) {
        setError(data.message ?? t("Login failed. Please check your credentials."));
        return;
      }

      setToken(data.access_token);
      router.replace(getHomePathForRole(parseToken(data.access_token)?.role));
    } catch {
      setError(t("Backend is not reachable right now."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,#fee2e2_0%,#fff7ed_35%,#f8fafc_100%)] px-6">
      <div className="w-full max-w-md rounded-[32px] border border-black/8 bg-white p-8 shadow-2xl shadow-red-100/50">
        <div className="mb-5 flex justify-end">
          <button
            type="button"
            className="rounded-2xl border border-black/10 px-4 py-2 text-sm font-bold text-slate-700"
            onClick={() => changeLanguage(language === "en" ? "ar" : "en")}
          >
            {language === "en" ? "عربي" : "EN"}
          </button>
        </div>
        <div>
          <Image
            src="/logo.png"
            alt="Meatena logo"
            width={260}
            height={160}
            className="mb-5 h-auto w-44 object-contain"
            priority
          />
          <p className="soft-label">{t("Secure Access")}</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-950">
            {t("Sign in to Meatena")}
          </h1>
        </div>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          {t("Use your staff or admin account to open the billing workspace.")}
        </p>

        <form
          className="mt-8 space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void login();
          }}
        >
          <input
            placeholder={t("Username")}
            className="field"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoComplete="username"
          />

          <input
            type="password"
            placeholder={t("Password")}
            className="field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
          />

          {error ? (
            <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
              {error}
            </div>
          ) : null}

          <button type="submit" className="btn-primary w-full" disabled={loading}>
            {loading ? t("Signing in...") : t("Login")}
          </button>
        </form>
      </div>
    </div>
  );
}
