"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { actors, type DemoRole } from "../lib/actors";

export function EscrowActions({
  dealId,
  dealStage,
  role,
  status,
  amountMinor,
  currency,
  buyerSigned,
  sellerSigned,
  platformConfirmed,
}: {
  dealId: string; dealStage: string; role: DemoRole; status: string; amountMinor: string; currency: string;
  buyerSigned: boolean; sellerSigned: boolean; platformConfirmed: boolean;
}) {
  const router = useRouter(); const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
  async function post(path: string, body?: unknown, idempotent = false) {
    setBusy(true); setError(null);
    const headers: Record<string,string> = { "content-type": "application/json", "x-demo-actor": actors[role].id };
    if (idempotent) headers["idempotency-key"] = crypto.randomUUID();
    const response = await fetch(`${apiUrl}/api${path}`, { method: "POST", headers, body: body ? JSON.stringify(body) : undefined });
    if (!response.ok) setError(await response.text()); else router.refresh();
    setBusy(false);
  }
  return <div>
    <div className="actions">
      {role === "buyer" && dealStage === "ESCROW" && status === "CREATED" && (
        <button className="button gold" disabled={busy} onClick={() => post(`/escrow/deals/${dealId}/fund`, { amountMinor, currency, provider: "STRIPE" }, true)}>Fund escrow</button>
      )}
      {role === "buyer" && status === "FUNDED" && !buyerSigned && (
        <button className="button" disabled={busy} onClick={() => post(`/escrow/deals/${dealId}/sign-off`, { party: "BUYER" })}>Buyer sign-off</button>
      )}
      {role === "seller" && ["FUNDED","VERIFICATION"].includes(status) && !sellerSigned && (
        <button className="button" disabled={busy} onClick={() => post(`/escrow/deals/${dealId}/sign-off`, { party: "SELLER" })}>Seller sign-off</button>
      )}
      {role === "advisor" && buyerSigned && sellerSigned && !platformConfirmed && (
        <button className="button" disabled={busy} onClick={() => post(`/escrow/deals/${dealId}/platform-confirm`)}>Confirm release</button>
      )}
      {role === "advisor" && status === "RELEASE_PENDING" && platformConfirmed && (
        <button className="button gold" disabled={busy} onClick={() => post(`/escrow/deals/${dealId}/release`, undefined, true)}>Release funds</button>
      )}
    </div>
    {error && <div className="alert" style={{ marginTop: 12 }}>{error}</div>}
  </div>;
}
