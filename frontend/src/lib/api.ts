import axios, { AxiosError, type AxiosInstance, type InternalAxiosRequestConfig } from "axios";

import { useAuthStore } from "@/store/authStore";
import type { ApiErrorBody } from "@/types/api";

const BASE_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:8000").replace(/\/$/, "");

export const api: AxiosInstance = axios.create({
  baseURL: `${BASE_URL}/api/v1`,
  headers: { "Content-Type": "application/json" },
  timeout: 30_000,
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  if (refreshing) return refreshing;
  const refresh = useAuthStore.getState().refreshToken;
  if (!refresh) return null;
  refreshing = (async () => {
    try {
      const resp = await axios.post(
        `${BASE_URL}/api/v1/auth/refresh`,
        { refresh_token: refresh },
        { headers: { "Content-Type": "application/json" } },
      );
      const access = resp.data?.access_token as string | undefined;
      if (access) {
        useAuthStore.getState().setTokens(access, refresh);
        return access;
      }
      return null;
    } catch {
      return null;
    } finally {
      refreshing = null;
    }
  })();
  return refreshing;
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError<ApiErrorBody>) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;
    if (
      error.response?.status === 401 &&
      original &&
      !original._retry &&
      !original.url?.includes("/auth/login") &&
      !original.url?.includes("/auth/refresh") &&
      !original.url?.includes("/auth/signup")
    ) {
      original._retry = true;
      const newAccess = await refreshAccessToken();
      if (newAccess) {
        original.headers.Authorization = `Bearer ${newAccess}`;
        return api(original);
      }
      useAuthStore.getState().logout();
      if (typeof window !== "undefined") {
        const here = window.location.pathname + window.location.search;
        const isAuthPage = ["/login", "/signup"].some((p) => window.location.pathname.startsWith(p));
        if (!isAuthPage) {
          window.location.href = `/login?next=${encodeURIComponent(here)}`;
        }
      }
    }
    return Promise.reject(error);
  },
);

export function getApiErrorMessage(error: unknown): string {
  const ax = error as AxiosError<ApiErrorBody>;
  return (
    ax?.response?.data?.detail?.message ||
    ax?.message ||
    "Something went wrong. Please try again."
  );
}

export function getApiFieldErrors(error: unknown): Record<string, string> {
  const ax = error as AxiosError<ApiErrorBody>;
  return ax?.response?.data?.detail?.fields ?? {};
}
