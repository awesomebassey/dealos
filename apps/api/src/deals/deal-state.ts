import { DealStage } from "@prisma/client";

export const allowedTransitions: Record<DealStage, DealStage[]> = {
  NDA_PENDING: [DealStage.DILIGENCE, DealStage.WITHDRAWN],
  DILIGENCE: [DealStage.LOI, DealStage.WITHDRAWN],
  LOI: [DealStage.FULL_DILIGENCE, DealStage.WITHDRAWN],
  FULL_DILIGENCE: [DealStage.SPA, DealStage.WITHDRAWN],
  SPA: [DealStage.ESCROW, DealStage.WITHDRAWN],
  ESCROW: [DealStage.ASSET_TRANSFER, DealStage.WITHDRAWN],
  ASSET_TRANSFER: [DealStage.COMPLETED, DealStage.WITHDRAWN],
  COMPLETED: [],
  WITHDRAWN: [],
};

export function canTransitionDeal(from: DealStage, to: DealStage) {
  return allowedTransitions[from].includes(to);
}
