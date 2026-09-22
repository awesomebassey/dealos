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
  provider: z.enum(["PAYSTACK", "WIRE"]),
});

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(10).max(128),
  role: z.enum(["BUYER", "SELLER"]),
});

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(20),
  password: z.string().min(10).max(128),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: z.string().min(10).max(128),
});

export const signOffSchema = z.object({
  party: z.enum(["BUYER", "SELLER"]),
});

export const createListingSchema = z.object({
  name: z.string().trim().min(3).max(120),
  category: z.string().trim().min(2).max(80),
  askingPriceNaira: z.number().int().min(10000).max(10000000000),
  annualRevenueNaira: z.number().int().nonnegative().max(10000000000),
  recurringRevenuePct: z.number().int().min(0).max(100),
  customerConcentration: z.number().int().min(0).max(100),
  revenueTrendPct: z.number().int().min(-100).max(500),
  ownerHoursPerWeek: z.number().int().min(0).max(168),
  ipAssigned: z.boolean(),
  litigationOpen: z.boolean(),
});

export const evidenceUploadSchema = z.object({
  category: z.enum(["IDENTITY", "BUSINESS", "REVENUE"]),
  documentType: z.enum([
    "NIN_SLIP", "BVN_CONFIRMATION", "DRIVERS_LICENSE", "VOTERS_CARD",
    "CAC_CERTIFICATE", "OWNERSHIP_PROOF", "ADDRESS_EVIDENCE",
    "BANK_STATEMENT", "PROFIT_LOSS",
  ]),
  fileName: z.string().min(1).max(150),
  contentType: z.enum(["application/pdf", "image/jpeg", "image/png"]),
  dataBase64: z.string().min(12).max(5_600_000),
});

export const verificationReviewSchema = z.object({
  category: z.enum(["IDENTITY", "BUSINESS", "REVENUE"]),
  approve: z.boolean(),
  note: z.string().trim().max(500).optional(),
});

export const submitOfferSchema = z.object({
  amountNaira: z.number().int().min(10000).max(10000000000),
  message: z.string().trim().max(2000).optional(),
});

export const walletTopupSchema = z.object({
  amountNaira: z.number().int().min(1000).max(10000000000),
});

export type DealStage = z.infer<typeof dealStageSchema>;
export type TransitionDealInput = z.infer<typeof transitionDealSchema>;
export type FundEscrowInput = z.infer<typeof fundEscrowSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
