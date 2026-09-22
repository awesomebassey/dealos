import { EscrowStatus } from "@prisma/client";

type ReleaseState = {
  status: EscrowStatus;
  buyerSignedOffAt: Date | null;
  sellerSignedOffAt: Date | null;
  platformConfirmedAt: Date | null;
  disputedAt: Date | null;
};

export function escrowReleaseBlocker(state: ReleaseState): string | null {
  if (state.status !== EscrowStatus.RELEASE_PENDING) return "Escrow is not ready for release";
  if (!state.buyerSignedOffAt) return "Buyer completion sign-off is missing";
  if (!state.sellerSignedOffAt) return "Seller completion sign-off is missing";
  if (!state.platformConfirmedAt) return "Platform release confirmation is missing";
  if (state.disputedAt) return "Escrow has an open dispute";
  return null;
}
