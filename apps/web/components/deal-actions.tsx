"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { clientApi } from "../lib/client-api";

const nextStage: Record<string, string> = {
  NDA_PENDING: "DILIGENCE",
  DILIGENCE: "LOI",
  LOI: "FULL_DILIGENCE",
  FULL_DILIGENCE: "SPA",
  SPA: "ESCROW",
  ESCROW: "ASSET_TRANSFER",
  ASSET_TRANSFER: "COMPLETED",
};

function label(stage: string) {
  return stage.replaceAll("_", " ").toLowerCase();
}

export function DealActions({
  dealId,
  stage,
  version,
  userRole,
}: {
  dealId: string;
  stage: string;
  version: number;
  userRole: string;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const canAdvance = ["ADVISOR", "ADMIN"].includes(userRole) && nextStage[stage];
  const canSignNda = userRole === "BUYER" && stage === "NDA_PENDING";

  async function request(path: string, body?: unknown) {
    setBusy(true);
    try {
      await clientApi(path, {
        method: "POST",
        body: body ? JSON.stringify(body) : undefined,
      });
      toast.success(canSignNda ? "NDA signed" : "Deal stage updated");
      setOpen(false);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update deal");
    } finally {
      setBusy(false);
    }
  }

  if (canSignNda) {
    return <button className="button" disabled={busy} onClick={() => request(`/deals/${dealId}/nda/sign`)}>{busy ? "Signing" : "Review and sign NDA"}</button>;
  }
  if (!canAdvance) return null;

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild><button className="button">Move to {label(nextStage[stage])}</button></Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay"/>
        <Dialog.Content className="dialog-content">
          <Dialog.Title asChild><h2>Advance this transaction?</h2></Dialog.Title>
          <Dialog.Description>
            The deal will move from {label(stage)} to {label(nextStage[stage])}. This action is recorded in the transaction history.
          </Dialog.Description>
          <div className="dialog-actions">
            <Dialog.Close asChild><button className="button secondary">Cancel</button></Dialog.Close>
            <button
              className="button"
              disabled={busy}
              onClick={() => request(`/deals/${dealId}/transition`, { to: nextStage[stage], expectedVersion: version })}
            >
              {busy ? "Updating" : "Confirm stage change"}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
