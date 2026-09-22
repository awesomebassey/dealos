"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { actors, type DemoRole } from "../lib/actors";

const nextStage: Record<string, string> = {
  NDA_PENDING: "DILIGENCE",
  DILIGENCE: "LOI",
  LOI: "FULL_DILIGENCE",
  FULL_DILIGENCE: "SPA",
  SPA: "ESCROW",
  ESCROW: "ASSET_TRANSFER",
  ASSET_TRANSFER: "COMPLETED",
};

export function DealActions({
  dealId,
  stage,
  version,
  role,
}: {
  dealId: string;
  stage: string;
  version: number;
  role: DemoRole;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

  async function request(path: string, body?: unknown) {
    setBusy(true); setError(null);
    try {
      const response = await fetch(`${apiUrl}/api${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", "x-demo-actor": actors[role].id },
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) throw new Error(await response.text());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed");
    } finally { setBusy(false); }
  }

  const canAdvance = role === "advisor" && nextStage[stage];
  const canSignNda = role === "buyer" && stage === "NDA_PENDING";

  if (!canAdvance && !canSignNda) return null;
  return (
    <div>
      <div className="actions">
        {canSignNda && <button className="button" disabled={busy} onClick={() => request(`/deals/${dealId}/nda/sign`)}>Sign NDA</button>}
        {canAdvance && (
          <button className="button" disabled={busy} onClick={() => request(`/deals/${dealId}/transition`, { to: nextStage[stage], expectedVersion: version })}>
            Advance to {nextStage[stage].replaceAll("_", " ").toLowerCase()}
          </button>
        )}
      </div>
      {error && <div className="alert" style={{ marginTop: 12 }}>{error}</div>}
    </div>
  );
}
