import { EscrowStatus } from "@prisma/client";
import { escrowReleaseBlocker } from "./escrow-policy";

const now = new Date();

describe("escrow release policy", () => {
  it("allows release only after both parties and platform confirm", () => {
    expect(escrowReleaseBlocker({
      status: EscrowStatus.RELEASE_PENDING,
      buyerSignedOffAt: now,
      sellerSignedOffAt: now,
      platformConfirmedAt: now,
      disputedAt: null,
    })).toBeNull();
  });

  it("blocks disputed or incompletely signed escrows", () => {
    expect(escrowReleaseBlocker({
      status: EscrowStatus.RELEASE_PENDING,
      buyerSignedOffAt: now,
      sellerSignedOffAt: null,
      platformConfirmedAt: now,
      disputedAt: null,
    })).toMatch(/Seller/);

    expect(escrowReleaseBlocker({
      status: EscrowStatus.RELEASE_PENDING,
      buyerSignedOffAt: now,
      sellerSignedOffAt: now,
      platformConfirmedAt: now,
      disputedAt: now,
    })).toMatch(/dispute/);
  });
});
