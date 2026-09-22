"use client";

import { ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { clientApi } from "../lib/client-api";

export function StartDealButton({ slug }: { slug: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function start() {
    setBusy(true);
    try {
      const deal = await clientApi<{ id: string }>(`/listings/${slug}/start-deal`, { method: "POST" });
      toast.success("Acquisition workspace opened");
      router.push(`/deals/${deal.id}`);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to start acquisition");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="button" disabled={busy} onClick={start}>
      {busy ? "Opening workspace" : "Start acquisition"} <ArrowRight size={15}/>
    </button>
  );
}
