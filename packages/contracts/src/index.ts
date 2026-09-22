import { z } from "zod";

export const dealStageSchema = z.enum([
  "NDA_PENDING",
  "DILIGENCE",
  "LOI",
  "FULL_DILIGENCE",
  "SPA",
  "ESCROW",
  "ASSET_TRANSFER",
  "COMPLETED",
  "WITHDRAWN",
]);

export const transitionDealSchema = z.object({
  to: dealStageSchema,
  expectedVersion: z.number().int().nonnegative(),
  note: z.string().trim().max(500).optional(),
});

export const fundEscrowSchema = z.object({
  amountMinor: z.string().regex(/^\d+$/),
  currency: z.enum(["USD", "NGN", "GHS", "KES", "ZAR", "GBP", "EUR"]),
  provider: z.enum(["PAYSTACK", "STRIPE", "WIRE"]),
});

export const signOffSchema = z.object({
  party: z.enum(["BUYER", "SELLER"]),
});

export type DealStage = z.infer<typeof dealStageSchema>;
export type TransitionDealInput = z.infer<typeof transitionDealSchema>;
export type FundEscrowInput = z.infer<typeof fundEscrowSchema>;
