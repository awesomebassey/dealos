"use client";

import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { clientApi } from "../lib/client-api";

export function DataRoomAction({ documentId, dealId }: { documentId: string; dealId: string }) {
  const [busy, setBusy] = useState(false);

  async function open() {
    setBusy(true);
    try {
      const data = await clientApi<{ signedUrl: string }>(
        `/data-room/documents/${documentId}/access?dealId=${dealId}`,
        { method: "POST" },
      );
      toast.success("Document access recorded");
      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to open document");
    } finally {
      setBusy(false);
    }
  }

  return (
    <button className="button secondary" disabled={busy} onClick={open}>
      {busy ? "Opening" : "Open"} <ExternalLink size={14}/>
    </button>
  );
}
