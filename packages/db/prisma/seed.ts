import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  UserRole,
  DealStage,
  NdaStatus,
  EscrowStatus,
  KycStatus,
  FindingSeverity,
} from "@prisma/client";
import { config } from "dotenv";
import { resolve } from "node:path";
import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);

async function demoPasswordHash(password: string) {
  const salt = randomBytes(16);
  const key = (await scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 })) as Buffer;
  return ["scrypt", 32768, 8, 1, salt.toString("base64url"), key.toString("base64url")].join("$");
}

config({ path: resolve(process.cwd(), "../../.env"), quiet: true });

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const ids = {
  buyer: "10000000-0000-0000-0000-000000000001",
  seller: "10000000-0000-0000-0000-000000000002",
  advisor: "10000000-0000-0000-0000-000000000003",
  sellerOrg: "20000000-0000-0000-0000-000000000001",
  listing: "30000000-0000-0000-0000-000000000001",
  deal: "40000000-0000-0000-0000-000000000001",
};

async function main() {
  await prisma.ledgerEntry.deleteMany();
  await prisma.escrowTransaction.deleteMany();
  await prisma.escrowAccount.deleteMany();
  await prisma.dataRoomAccess.deleteMany();
  await prisma.dataRoomDocument.deleteMany();
  await prisma.dueDiligenceQuestion.deleteMany();
  await prisma.dueDiligenceFinding.deleteMany();
  await prisma.assetTransferItem.deleteMany();
  await prisma.ndaAgreement.deleteMany();
  await prisma.auditEvent.deleteMany();
  await prisma.dealParticipant.deleteMany();
  await prisma.deal.deleteMany();
  await prisma.passwordResetToken.deleteMany();
  await prisma.session.deleteMany();
  await prisma.kycCase.deleteMany();
  await prisma.listing.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.idempotencyRecord.deleteMany();
  await prisma.outboxEvent.deleteMany();

  await prisma.organization.create({
    data: {
      id: ids.sellerOrg,
      name: "KoraMetrics Ltd",
      country: "Nigeria",
    },
  });

  const passwordHash = await demoPasswordHash("DealOS2026!");

  await prisma.user.createMany({
    data: [
      {
        id: ids.buyer,
        name: "Amara Okafor",
        email: "amara@northstar.capital",
        role: UserRole.BUYER,
        passwordHash,
      },
      {
        id: ids.seller,
        name: "Tunde Adebayo",
        email: "tunde@korametrics.example",
        role: UserRole.SELLER,
        passwordHash,
        organizationId: ids.sellerOrg,
      },
      {
        id: ids.advisor,
        name: "Nia Mensah",
        email: "nia@dealos.example",
        role: UserRole.ADVISOR,
        passwordHash,
      },
    ],
  });

  await prisma.kycCase.createMany({
    data: [
      {
        userId: ids.buyer,
        status: KycStatus.VERIFIED,
        identityVerified: true,
        businessVerified: true,
        revenueVerified: false,
        riskScore: 8,
        country: "Nigeria",
        reviewedAt: new Date(),
      },
      {
        userId: ids.seller,
        status: KycStatus.VERIFIED,
        identityVerified: true,
        businessVerified: true,
        revenueVerified: true,
        riskScore: 12,
        country: "Nigeria",
        reviewedAt: new Date(),
      },
    ],
  });

  await prisma.listing.create({
    data: {
      id: ids.listing,
      organizationId: ids.sellerOrg,
      name: "KoraMetrics",
      slug: "korametrics",
      category: "SaaS / Analytics",
      country: "Nigeria",
      askingPriceMinor: 65000000000n,
      currency: "NGN",
      annualRevenueMinor: 41000000000n,
      recurringRevenuePct: 81,
      customerConcentration: 38,
      revenueTrendPct: -6,
      ownerHoursPerWeek: 32,
      ipAssigned: false,
      litigationOpen: false,
    },
  });

  await prisma.deal.create({
    data: {
      id: ids.deal,
      ref: "DL-2026-0042",
      listingId: ids.listing,
      stage: DealStage.FULL_DILIGENCE,
      version: 3,
      agreedPriceMinor: 59500000000n,
      currency: "NGN",
      participants: {
        create: [
          { userId: ids.buyer, role: UserRole.BUYER },
          { userId: ids.seller, role: UserRole.SELLER },
          { userId: ids.advisor, role: UserRole.ADVISOR },
        ],
      },
      ndaAgreements: {
        create: {
          userId: ids.buyer,
          version: "4.2",
          status: NdaStatus.SIGNED,
          signedAt: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000),
        },
      },
      assetItems: {
        create: [
          { label: "Primary domain and DNS" },
          { label: "Source repositories and CI access" },
          { label: "Cloud accounts and infrastructure" },
          { label: "Customer contracts and CRM export" },
          { label: "Brand assets and intellectual property" },
        ],
      },
    },
  });

  await prisma.dataRoomDocument.createMany({
    data: [
      {
        listingId: ids.listing,
        name: "FY2025 P&L.pdf",
        category: "Financial",
        objectKey: "korametrics/financial/fy2025-pnl.pdf",
        contentType: "application/pdf",
        sizeBytes: 1142032,
      },
      {
        listingId: ids.listing,
        name: "MRR cohort export.xlsx",
        category: "Financial",
        objectKey: "korametrics/financial/mrr-cohorts.xlsx",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        sizeBytes: 483220,
      },
      {
        listingId: ids.listing,
        name: "Customer concentration.csv",
        category: "Customers",
        objectKey: "korametrics/customers/concentration.csv",
        contentType: "text/csv",
        sizeBytes: 98112,
      },
      {
        listingId: ids.listing,
        name: "IP assignment register.pdf",
        category: "Legal",
        objectKey: "korametrics/legal/ip-register.pdf",
        contentType: "application/pdf",
        sizeBytes: 720441,
      },
      {
        listingId: ids.listing,
        name: "Infrastructure overview.pdf",
        category: "Technical",
        objectKey: "korametrics/technical/infrastructure.pdf",
        contentType: "application/pdf",
        sizeBytes: 820991,
      },
    ],
  });

  await prisma.escrowAccount.create({
    data: {
      dealId: ids.deal,
      status: EscrowStatus.CREATED,
      amountMinor: 59500000000n,
      currency: "NGN",
    },
  });

  await prisma.dueDiligenceFinding.createMany({
    data: [
      {
        dealId: ids.deal,
        code: "CUSTOMER_CONCENTRATION",
        title: "Customer concentration above threshold",
        severity: FindingSeverity.HIGH,
        detail: "The largest customer represents 38% of annual revenue.",
        evidence: { concentrationPct: 38, thresholdPct: 30 },
      },
      {
        dealId: ids.deal,
        code: "REVENUE_TREND",
        title: "Recent revenue decline",
        severity: FindingSeverity.MEDIUM,
        detail: "Revenue is down 6% across the latest comparison period.",
        evidence: { trendPct: -6 },
      },
      {
        dealId: ids.deal,
        code: "IP_ASSIGNMENT",
        title: "IP assignment needs confirmation",
        severity: FindingSeverity.HIGH,
        detail: "The seller has not yet confirmed that all contributor IP is assigned to the company.",
        evidence: { ipAssigned: false },
      },
    ],
  });

  await prisma.dueDiligenceQuestion.createMany({
    data: [
      {
        dealId: ids.deal,
        question: "What contract term, renewal date, and termination rights apply to the largest customer?",
      },
      {
        dealId: ids.deal,
        question: "Which revenue movements explain the recent 6% decline, and has the trend continued in the current month?",
      },
      {
        dealId: ids.deal,
        question: "Can you provide signed IP assignment agreements for employees and contractors who contributed to the product?",
      },
    ],
  });

  const events = [
    ["DEAL_CREATED", null, "NDA_PENDING", "Deal opened for KoraMetrics"],
    ["NDA_SIGNED", "NDA_PENDING", "DILIGENCE", "Buyer signed NDA v4.2"],
    ["LOI_ACCEPTED", "DILIGENCE", "LOI", "Seller accepted the ₦595,000,000 LOI"],
    ["FULL_DILIGENCE_STARTED", "LOI", "FULL_DILIGENCE", "Full diligence workspace opened"],
  ] as const;

  for (let i = 0; i < events.length; i++) {
    const [action, previousState, nextState, summary] = events[i];
    await prisma.auditEvent.create({
      data: {
        dealId: ids.deal,
        actorId: i === 0 ? ids.advisor : i === 1 ? ids.buyer : ids.advisor,
        resourceType: "DEAL",
        resourceId: ids.deal,
        action,
        previousState,
        nextState,
        metadata: { summary },
        correlationId: `seed-${i + 1}`,
        createdAt: new Date(Date.now() - (7 - i) * 24 * 60 * 60 * 1000),
      },
    });
  }

  console.log("DealOS seeded", ids);
}

main().finally(() => prisma.$disconnect());
