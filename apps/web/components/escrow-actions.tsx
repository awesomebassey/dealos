"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { clientApi } from "../lib/client-api";
import { money } from "../lib/money-client";

type Action = {
  label: string;
  title: string;
  description: string;
  path: string;
  body?: unknown;
  idempotent?: boolean;
};

export function EscrowActions({
  dealId,
  dealStage,
  userRole,
  status,
  amountMinor,
  buyerSigned,
  sellerSigned,
  platformConfirmed,
}: {
  dealId: string;
  dealStage: string;
  userRole: string;
  status: string;
  amountMinor: string;
  buyerSigned: boolean;
  sellerSigned: boolean;
  platformConfirmed: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [action, setAction] = useState<Action | null>(null);

  let available: Action | null = null;
  if (userRole === "BUYER" && dealStage === "ESCROW" && status === "CREATED") {
    available = {
      label: "Fund escrow",
      title: "Fund this escrow?",
      description: `You are about to fund ${money(amountMinor)} for this acquisition. The funding action is recorded against the deal.`,
      path: `/escrow/deals/${dealId}/fund`,
      body: { amountMinor, provider: "PAYSTACK" },
      idempotent: true,
    };
  } else if (userRole === "BUYER" && status === "FUNDED" && !buyerSigned) {
    available = {
      label: "Confirm buyer completion",
      title: "Confirm your side is complete?",
      description: "Confirm only after you have verified the agreed assets and access. This confirmation contributes to escrow release.",
      path: `/escrow/deals/${dealId}/sign-off`,
      body: { party: "BUYER" },
    };
  } else if (userRole === "SELLER" && ["FUNDED", "VERIFICATION"].includes(status) && !sellerSigned) {
    available = {
      label: "Confirm seller completion",
      title: "Confirm asset transfer is complete?",
      description: "This records the seller completion confirmation and moves the transaction closer to release.",
      path: `/escrow/deals/${dealId}/sign-off`,
      body: { party: "SELLER" },
    };
  } else if (["ADVISOR", "ADMIN"].includes(userRole) && buyerSigned && sellerSigned && !platformConfirmed) {
    available = {
      label: "Confirm release conditions",
      title: "Confirm release conditions?",
      description: "Both parties have signed off. Confirm that the platform checks are complete before funds become releasable.",
      path: `/escrow/deals/${dealId}/platform-confirm`,
    };
  } else if (["ADVISOR", "ADMIN"].includes(userRole) && status === "RELEASE_PENDING" && platformConfirmed) {
    available = {
      label: "Release funds",
      title: "Release escrow funds?",
      description: `This will record the release of ${money(amountMinor)} to the seller and complete the transaction.`,
      path: `/escrow/deals/${dealId}/release`,
      idempotent: true,
    };
  }

  async function run() {
    if (!action) return;
    setBusy(true);
    try {
      const headers: Record<string,string> = {};
      if (action.idempotent) headers["idempotency-key"] = crypto.randomUUID();
      await clientApi(action.path, {
        method: "POST",
        headers,
        body: action.body ? JSON.stringify(action.body) : undefined,
      });
      toast.success("Escrow updated");
      setAction(null);
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Unable to update escrow");
    } finally {
      setBusy(false);
    }
  }

  if (!available) return null;

  return (
    <Dialog.Root open={!!action} onOpenChange={(open) => !open && setAction(null)}>
      <Dialog.Trigger asChild>
        <button className="button" onClick={() => setAction(available)}>{available.label}</button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="dialog-overlay"/>
        <Dialog.Content className="dialog-content">
          <Dialog.Title asChild><h2>{action?.title}</h2></Dialog.Title>
          <Dialog.Description>{action?.description}</Dialog.Description>
          <div className="dialog-actions">
            <Dialog.Close asChild><button className="button secondary">Cancel</button></Dialog.Close>
            <button className="button" disabled={busy} onClick={run}>{busy ? "Processing" : "Confirm"}</button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
