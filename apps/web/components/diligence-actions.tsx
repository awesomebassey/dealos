"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { clientApi } from "../lib/client-api";

export function DiligenceActions({ dealId }: { dealId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      await clientApi(`/diligence/deals/${dealId}/run`, { method: "POST" });
      toast.success("Diligence review updated");
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to run diligence review");
    } finally {
      setBusy(false);
    }
  }

  return <button className="button" disabled={busy} onClick={run}>{busy ? "Reviewing" : "Refresh diligence review"}</button>;
}
