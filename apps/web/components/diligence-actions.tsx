"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { actors, type DemoRole } from "../lib/actors";

export function DiligenceActions({ dealId, role }: { dealId: string; role: DemoRole }) {
  const router = useRouter(); const [busy, setBusy] = useState(false);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  async function run() {
    setBusy(true);
    await fetch(`${apiUrl}/api/diligence/deals/${dealId}/run`, { method: "POST", headers: { "x-demo-actor": actors[role].id } });
    setBusy(false); router.refresh();
  }
  return <button className="button" disabled={busy} onClick={run}>{busy ? "Reviewing..." : "Run diligence review"}</button>;
}
