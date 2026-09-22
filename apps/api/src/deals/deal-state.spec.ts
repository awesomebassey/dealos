import { DealStage } from "@prisma/client";
import { canTransitionDeal } from "./deal-state";

describe("deal state machine", () => {
  it("allows the expected forward path", () => {
    expect(canTransitionDeal(DealStage.NDA_PENDING, DealStage.DILIGENCE)).toBe(true);
    expect(canTransitionDeal(DealStage.FULL_DILIGENCE, DealStage.SPA)).toBe(true);
    expect(canTransitionDeal(DealStage.ESCROW, DealStage.ASSET_TRANSFER)).toBe(true);
  });

  it("rejects stage skipping and reopening terminal deals", () => {
    expect(canTransitionDeal(DealStage.NDA_PENDING, DealStage.ESCROW)).toBe(false);
    expect(canTransitionDeal(DealStage.COMPLETED, DealStage.ESCROW)).toBe(false);
    expect(canTransitionDeal(DealStage.WITHDRAWN, DealStage.DILIGENCE)).toBe(false);
  });
});
