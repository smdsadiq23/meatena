"use client";

function getBrowserApiUrl() {
  if (typeof window === "undefined") {
    return "http://127.0.0.1:3003";
  }

  const hostname = window.location.hostname === "localhost" ? "127.0.0.1" : window.location.hostname;
  return `${window.location.protocol}//${hostname}:3003`;
}

export const API = process.env.NEXT_PUBLIC_API_URL ?? getBrowserApiUrl();
const TOKEN_KEY = "token";
const TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 7;

function notifyAuthChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event("auth-change"));
  }
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export type AuthUser = {
  sub: number;
  username: string;
  role: UserRole;
  exp?: number;
};

export type UserRole = "admin" | "staff";

export function getHomePathForRole(role?: UserRole | null) {
  return role === "admin" ? "/dashboard" : "/invoice";
}

function decodeBase64Url(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return atob(padded);
}

function getCookie(name: string) {
  if (typeof document === "undefined") {
    return null;
  }

  const prefix = `${encodeURIComponent(name)}=`;
  const cookie = document.cookie
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix));

  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
}

function setCookie(name: string, value: string) {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${encodeURIComponent(name)}=${encodeURIComponent(value)}; Max-Age=${TOKEN_MAX_AGE_SECONDS}; Path=/; SameSite=Lax`;
}

function deleteCookie(name: string) {
  if (typeof document === "undefined") {
    return;
  }

  document.cookie = `${encodeURIComponent(name)}=; Max-Age=0; Path=/; SameSite=Lax`;
}

export function getToken() {
  if (typeof window === "undefined") {
    return null;
  }

  const localToken = window.localStorage.getItem(TOKEN_KEY);
  const cookieToken = getCookie(TOKEN_KEY);
  const token = localToken || cookieToken;

  if (token && token !== localToken) {
    window.localStorage.setItem(TOKEN_KEY, token);
  }

  if (token && token !== cookieToken) {
    setCookie(TOKEN_KEY, token);
  }

  return token;
}

export function setToken(token: string) {
  window.localStorage.setItem(TOKEN_KEY, token);
  setCookie(TOKEN_KEY, token);
  notifyAuthChange();
}

export function clearToken() {
  window.localStorage.removeItem(TOKEN_KEY);
  deleteCookie(TOKEN_KEY);
  notifyAuthChange();
}

export function parseToken(token: string | null): AuthUser | null {
  if (!token) {
    return null;
  }

  try {
    const [, payload] = token.split(".");
    return JSON.parse(decodeBase64Url(payload)) as AuthUser;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string | null) {
  const payload = parseToken(token);

  if (!payload?.exp) {
    return true;
  }

  return payload.exp * 1000 <= Date.now();
}

export function getAuthUser() {
  return parseToken(getToken());
}

export function hasValidToken() {
  const token = getToken();
  return Boolean(token) && !isTokenExpired(token);
}

export function createAuthHeaders(headers?: HeadersInit) {
  const token = getToken();
  const nextHeaders = new Headers(headers);

  if (token) {
    nextHeaders.set("Authorization", `Bearer ${token}`);
  }

  return nextHeaders;
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const headers = createAuthHeaders(init.headers);

  if (init.body && !(init.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API}${path}`, {
    ...init,
    headers,
  });

  if (response.status === 401) {
    const token = getToken();

    if (!token || isTokenExpired(token)) {
      clearToken();
      if (typeof window !== "undefined" && window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
  }

  return response;
}

export async function getErrorMessage(response: Response) {
  try {
    const data = (await response.json()) as { message?: string | string[] };

    if (Array.isArray(data.message)) {
      return data.message.join(", ");
    }

    if (typeof data.message === "string" && data.message.trim()) {
      return data.message;
    }
  } catch {
    // Ignore non-JSON error bodies and fall back to a generic message.
  }

  return "Something went wrong";
}

export async function fetchJsonOrThrow<T>(path: string, init?: RequestInit) {
  const response = await apiFetch(path, init);

  if (!response.ok) {
    throw new ApiError(await getErrorMessage(response), response.status);
  }

  return (await response.json()) as T;
}

export async function fetchJson<T>(path: string, init?: RequestInit) {
  return fetchJsonOrThrow<T>(path, init);
}

export async function downloadAuthenticatedFile(path: string, filename: string) {
  const response = await apiFetch(path);

  if (!response.ok) {
    throw new ApiError(await getErrorMessage(response), response.status);
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}
