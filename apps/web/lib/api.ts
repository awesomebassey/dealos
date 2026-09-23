import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const API_URL = process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export type CurrentUser = {
  id: string;
  name: string;
  email: string;
  role: "BUYER" | "SELLER" | "ADVISOR" | "ADMIN";
  createdAt: string;
};

export async function api<T>(path: string, options?: { allowUnauthorized?: boolean }): Promise<T> {
  const store = await cookies();
  const cookieHeader = store.toString();
  const response = await fetch(`${API_URL}/api${path}`, {
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    cache: "no-store",
  });

  if (response.status === 401 && !options?.allowUnauthorized) {
    redirect("/login");
  }

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `API request failed: ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export function currentUser() {
  return api<CurrentUser>("/auth/me");
}

export async function optionalCurrentUser(): Promise<CurrentUser | null> {
  const store = await cookies();
  const cookieHeader = store.toString();
  const response = await fetch(`${API_URL}/api/auth/me`, {
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
    cache: "no-store",
  });
  if (response.status === 401) return null;
  if (!response.ok) return null;
  return response.json() as Promise<CurrentUser>;
}

export async function publicApi<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}/api${path}`, { cache: "no-store" });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || `API request failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

export type Deal = {
  id: string;
  ref: string;
  stage: string;
  version: number;
  agreedPriceMinor: string | null;
  updatedAt: string;
  listing: {
    name: string;
    category: string;
    askingPriceMinor: string;
    annualRevenueMinor: string;
    organization: { name: string };
  };
  participants: Array<{ user: { id: string; name: string; role: string } }>;
  escrow?: { status: string; amountMinor: string } | null;
  findings?: Array<{ id: string; severity: string; title: string; detail: string }>;
};

export function money(minor: string | number | bigint | null | undefined) {
  if (minor == null) return "Not set";
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    maximumFractionDigits: 0,
  }).format(Number(minor) / 100);
}

export function sentence(value: string) {
  const text = value.replaceAll("_", " ").toLowerCase();
  return text.charAt(0).toUpperCase() + text.slice(1);
}
