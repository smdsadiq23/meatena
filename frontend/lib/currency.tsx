"use client";

import { useSyncExternalStore } from "react";
import { API, fetchJsonOrThrow } from "./auth";

const DEFAULT_KWD_TO_USD_RATE = Number(process.env.NEXT_PUBLIC_KWD_TO_USD_RATE ?? 3.25);
const STORAGE_KEY = "kwd_to_usd_rate";

let currentRate = DEFAULT_KWD_TO_USD_RATE;
const listeners = new Set<() => void>();

function readStoredRate() {
  if (typeof window === "undefined") {
    return currentRate;
  }

  const stored = Number(window.localStorage.getItem(STORAGE_KEY));
  return Number.isFinite(stored) && stored > 0 ? stored : currentRate;
}

function emitRateChange() {
  listeners.forEach((listener) => listener());
}

export function setCurrencyRate(rate: number) {
  if (!Number.isFinite(rate) || rate <= 0) {
    return;
  }

  currentRate = rate;

  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, String(rate));
  }

  emitRateChange();
}

export async function loadCurrencyRate() {
  try {
    const response = await fetch(`${API}/settings/currency-rate`, { cache: "no-store" });

    if (!response.ok) {
      throw new Error(`Currency rate request failed with ${response.status}`);
    }

    const data = (await response.json()) as { kwd_to_usd_rate?: number };
    setCurrencyRate(Number(data.kwd_to_usd_rate));
  } catch {
    currentRate = readStoredRate();
    emitRateChange();
  }
}

export async function saveCurrencyRate(rate: number) {
  const data = await fetchJsonOrThrow<{ kwd_to_usd_rate: number }>("/settings/currency-rate", {
    method: "PATCH",
    body: JSON.stringify({ kwd_to_usd_rate: rate }),
  });
  setCurrencyRate(Number(data.kwd_to_usd_rate));
  return data;
}

export function subscribeCurrencyRate(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCurrencyRateSnapshot() {
  currentRate = readStoredRate();
  return currentRate;
}

export function useCurrencyRate() {
  return useSyncExternalStore(
    subscribeCurrencyRate,
    getCurrencyRateSnapshot,
    () => DEFAULT_KWD_TO_USD_RATE
  );
}

export function kwdToUsd(value: number | string | undefined | null, rate = currentRate) {
  return Number(value ?? 0) * rate;
}

export function formatKwd(value: number | string | undefined | null) {
  return `KWD ${Number(value ?? 0).toFixed(3)}`;
}

export function formatUsd(value: number | string | undefined | null) {
  return `USD ${kwdToUsd(value).toFixed(2)}`;
}

export function formatDualCurrency(value: number | string | undefined | null) {
  return `${formatKwd(value)} | ${formatUsd(value)}`;
}

export function Money({
  value,
  className = "",
  usdClassName = "",
}: {
  value: number | string | undefined | null;
  className?: string;
  usdClassName?: string;
}) {
  useCurrencyRate();

  return (
    <span className={`inline-flex min-w-0 max-w-full flex-col leading-[1.08] tracking-normal ${className}`}>
      <span className="block max-w-full whitespace-normal break-words">{formatKwd(value)}</span>
      <span className={`mt-1 block max-w-full whitespace-normal break-words text-[0.52em] font-extrabold leading-none tracking-normal opacity-70 ${usdClassName}`}>
        {formatUsd(value)}
      </span>
    </span>
  );
}
