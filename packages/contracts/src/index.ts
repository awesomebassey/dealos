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

export type DealStage = z.infer<typeof dealStageSchema>;
export type TransitionDealInput = z.infer<typeof transitionDealSchema>;
export type FundEscrowInput = z.infer<typeof fundEscrowSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
