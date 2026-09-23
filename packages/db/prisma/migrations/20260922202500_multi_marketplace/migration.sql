-- The migration is additive and does not delete existing user or deal data.
CREATE TYPE "ListingStatus" AS ENUM ('DRAFT','PUBLISHED','UNDER_OFFER','SOLD','ARCHIVED');
CREATE TYPE "EvidenceCategory" AS ENUM ('IDENTITY','BUSINESS','REVENUE');
CREATE TYPE "EvidenceStatus" AS ENUM ('SUBMITTED','APPROVED','REJECTED');
CREATE TYPE "OfferStatus" AS ENUM ('SUBMITTED','ACCEPTED','DECLINED','WITHDRAWN');
CREATE TYPE "WalletTxType" AS ENUM ('DEMO_TOPUP','ESCROW_FUNDING','ESCROW_RELEASE');
CREATE TYPE "WalletDirection" AS ENUM ('CREDIT','DEBIT');
ALTER TABLE "Listing" ADD COLUMN "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT';
UPDATE "Listing" SET "status" = 'PUBLISHED';
ALTER TABLE "Deal" ADD COLUMN "buyerId" TEXT;
UPDATE "Deal" AS d SET "buyerId" = p."userId" FROM "DealParticipant" AS p
WHERE p."dealId" = d.id AND p.role = 'BUYER' AND d."buyerId" IS NULL;
CREATE UNIQUE INDEX "Deal_listingId_buyerId_key" ON "Deal"("listingId","buyerId");
CREATE INDEX "Deal_buyerId_updatedAt_idx" ON "Deal"("buyerId","updatedAt");
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_buyerId_fkey"
FOREIGN KEY ("buyerId") REFERENCES "User"(id) ON UPDATE CASCADE ON DELETE SET NULL;
CREATE INDEX "Listing_status_createdAt_idx" ON "Listing"("status","createdAt");
CREATE INDEX "Listing_organizationId_status_idx" ON "Listing"("organizationId","status");
CREATE TABLE "VerificationEvidence"(
  id TEXT PRIMARY KEY, "caseId" TEXT NOT NULL, category "EvidenceCategory" NOT NULL,
  "documentType" TEXT NOT NULL, "fileName" TEXT NOT NULL, "contentType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL, "storageKey" TEXT NOT NULL UNIQUE,
  status "EvidenceStatus" NOT NULL DEFAULT 'SUBMITTED', "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3), "reviewNote" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VerificationEvidence_caseId_fkey" FOREIGN KEY("caseId") REFERENCES "KycCase"(id) ON DELETE CASCADE
);
CREATE INDEX "VerificationEvidence_caseId_category_createdAt_idx" ON "VerificationEvidence"("caseId",category,"createdAt");
CREATE TABLE "AcquisitionOffer"(
  id TEXT PRIMARY KEY, "dealId" TEXT NOT NULL UNIQUE, "buyerId" TEXT NOT NULL,
  "amountMinor" BIGINT NOT NULL, message TEXT,
  status "OfferStatus" NOT NULL DEFAULT 'SUBMITTED', "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AcquisitionOffer_dealId_fkey" FOREIGN KEY("dealId") REFERENCES "Deal"(id) ON DELETE CASCADE,
  CONSTRAINT "AcquisitionOffer_buyerId_fkey" FOREIGN KEY("buyerId") REFERENCES "User"(id)
);
CREATE TABLE "WalletAccount"(
 id TEXT PRIMARY KEY, "userId" TEXT NOT NULL UNIQUE, "balanceMinor" BIGINT NOT NULL DEFAULT 0,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "WalletAccount_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"(id) ON DELETE CASCADE
);
CREATE TABLE "WalletTransaction"(
 id TEXT PRIMARY KEY, "walletId" TEXT NOT NULL, "dealId" TEXT,
 direction "WalletDirection" NOT NULL, type "WalletTxType" NOT NULL,
 "amountMinor" BIGINT NOT NULL, "idempotencyKey" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "WalletTransaction_walletId_fkey" FOREIGN KEY("walletId") REFERENCES "WalletAccount"(id) ON DELETE CASCADE,
 CONSTRAINT "WalletTransaction_dealId_fkey" FOREIGN KEY("dealId") REFERENCES "Deal"(id)
);
CREATE UNIQUE INDEX "WalletTransaction_walletId_idempotencyKey_key" ON "WalletTransaction"("walletId","idempotencyKey");
CREATE INDEX "WalletTransaction_dealId_createdAt_idx" ON "WalletTransaction"("dealId","createdAt");
