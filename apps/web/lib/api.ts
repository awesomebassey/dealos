import "server-only";
import { actors, type DemoRole } from "./actors";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function api<T>(path: string, role: DemoRole): Promise<T> {
  const response = await fetch(`${API_URL}/api${path}`, {
    headers: { "x-demo-actor": actors[role].id },
    cache: "no-store",
  });
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
  currency: string;
  updatedAt: string;
  listing: {
    name: string;
    category: string;
    country: string;
    askingPriceMinor: string;
    annualRevenueMinor: string;
    organization: { name: string };
  };
  participants: Array<{ user: { id: string; name: string; role: string } }>;
  escrow?: { status: string; amountMinor: string; currency: string } | null;
  findings?: Array<{ id: string; severity: string; title: string; detail: string }>;
};

export function money(minor: string | number | bigint | null | undefined, currency = "USD") {
  if (minor == null) return "Not set";
  return new Intl.NumberFormat("en", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(minor) / 100);
}
