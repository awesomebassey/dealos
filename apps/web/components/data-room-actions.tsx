"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { ExternalLink } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { clientApi } from "../lib/client-api";

export function DataRoomAction({ documentId, dealId }: { documentId: string; dealId: string }) {
  const [busy, setBusy] = useState(false);
  const [signedUrl, setSignedUrl] = useState<string | null>(null);

  async function requestAccess() {
    setBusy(true);
    try {
      const data = await clientApi<{ signedUrl: string }>(
        `/data-room/documents/${documentId}/access?dealId=${dealId}`,
        { method: "POST" },
      );
      setSignedUrl(data.signedUrl);
      toast.success("Document access recorded");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to open document");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog.Root open={!!signedUrl} onOpenChange={(open) => !open && setSignedUrl(null)}>
      <button className="button secondary" disabled={busy} onClick={requestAccess}>
        {busy ? "Opening" : "Open"} <ExternalLink size={14}/>
      </button>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay"/>
        <Dialog.Content className="dialog-content">
          <Dialog.Title asChild><h2>Document access granted</h2></Dialog.Title>
          <Dialog.Description>
            Your access has been recorded against this transaction. The protected link expires shortly.
          </Dialog.Description>
          <div className="dialog-actions">
            <Dialog.Close asChild><button className="button secondary">Close</button></Dialog.Close>
            {signedUrl && <a className="button" href={signedUrl} target="_blank" rel="noreferrer">Open protected file</a>}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
