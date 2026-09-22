"use client";

import { useState } from "react";
import { actors, type DemoRole } from "../lib/actors";

export function DataRoomAction({ documentId, dealId, role }: { documentId: string; dealId: string; role: DemoRole }) {
  const [result, setResult] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

  async function open() {
    setBusy(true); setResult(null);
    const response = await fetch(`${apiUrl}/api/data-room/documents/${documentId}/access?dealId=${dealId}`, {
      method: "POST",
      headers: { "x-demo-actor": actors[role].id },
    });
    if (response.ok) {
      const data = await response.json();
      setResult(`Access granted for ${data.expiresInSeconds / 60} minutes`);
    } else {
      setResult("Access denied");
    }
    setBusy(false);
  }

  return <div style={{ textAlign: "right" }}><button className="button secondary" disabled={busy} onClick={open}>Open</button>{result && <div className="stat-foot">{result}</div>}</div>;
}
