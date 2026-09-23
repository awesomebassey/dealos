-- Independent verification for each listing; existing listings require re-review.
ALTER TABLE "DataRoomDocument" ADD COLUMN "contentBytes" BYTEA;
ALTER TABLE "VerificationEvidence" ADD COLUMN "contentBytes" BYTEA;

CREATE TABLE "ListingVerification" (
  "id" TEXT NOT NULL,
  "listingId" TEXT NOT NULL,
  "status" "KycStatus" NOT NULL DEFAULT 'PENDING',
  "businessVerified" BOOLEAN NOT NULL DEFAULT false,
  "revenueVerified" BOOLEAN NOT NULL DEFAULT false,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ListingVerification_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ListingVerification_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ListingVerification_listingId_key" ON "ListingVerification"("listingId");
CREATE INDEX "ListingVerification_status_updatedAt_idx" ON "ListingVerification"("status","updatedAt");

CREATE TABLE "ListingEvidence" (
  "id" TEXT NOT NULL,
  "verificationId" TEXT NOT NULL,
  "category" "EvidenceCategory" NOT NULL,
  "documentType" TEXT NOT NULL,
  "fileName" TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "contentBytes" BYTEA,
  "status" "EvidenceStatus" NOT NULL DEFAULT 'SUBMITTED',
  "reviewedById" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "reviewNote" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ListingEvidence_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "ListingEvidence_verificationId_fkey" FOREIGN KEY ("verificationId") REFERENCES "ListingVerification"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "ListingEvidence_verificationId_category_status_idx" ON "ListingEvidence"("verificationId","category","status");

INSERT INTO "ListingVerification" ("id","listingId","updatedAt")
SELECT CAST(gen_random_uuid() AS TEXT), l."id", CURRENT_TIMESTAMP
FROM "Listing" l
WHERE NOT EXISTS (SELECT 1 FROM "ListingVerification" v WHERE v."listingId"=l."id");
