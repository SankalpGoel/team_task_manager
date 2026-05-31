import { api } from "@/lib/api";
import type { AuthResponse, MeResponse } from "@/types/api";

export interface SignupPayload {
  email: string;
  password: string;
  full_name: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export async function signup(payload: SignupPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/auth/signup", payload);
  return data;
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>("/auth/login", payload);
  return data;
}

export async function fetchMe(): Promise<MeResponse> {
  const { data } = await api.get<MeResponse>("/auth/me");
  return data;
}

export async function changePassword(old_password: string, new_password: string): Promise<void> {
  await api.post("/auth/change-password", { old_password, new_password });
}

export async function updateProfile(payload: { full_name?: string; avatar_url?: string | null }) {
  const { data } = await api.patch("/auth/me", payload);
  return data;
}
