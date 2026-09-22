"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { actors, roleFrom } from "../lib/actors";

const titles: Record<string, string> = {
  "/dashboard": "Transaction overview",
  "/deals": "Deal pipeline",
  "/data-room": "Data room",
  "/due-diligence": "Due diligence",
  "/escrow": "Escrow operations",
  "/kyc": "Verification",
};

export function Topbar() {
  const path = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  const role = roleFrom(params.get("role") ?? undefined);
  const title = Object.entries(titles).find(([key]) => path === key || path.startsWith(`${key}/`))?.[1] ?? "DealOS";

  return (
    <header className="topbar">
      <div className="topbar-title">{title}</div>
      <select
        className="role-select"
        value={role}
        aria-label="Active role"
        onChange={(event) => router.push(`${path}?role=${event.target.value}`)}
      >
        {Object.entries(actors).map(([key, actor]) => (
          <option key={key} value={key}>{actor.label}: {actor.name}</option>
        ))}
      </select>
    </header>
  );
}
