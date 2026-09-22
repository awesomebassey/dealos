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
import { resolve, join } from "node:path";
import { mkdir, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { randomBytes, scrypt } from "node:crypto";

function deriveSeedPassword(password: string, salt: Buffer) {
  return new Promise<Buffer>((resolveKey, reject) => {
    scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => {
      if (error) reject(error);
      else resolveKey(key);
    });
  });
}

async function demoPasswordHash(password: string) {
  const salt = randomBytes(16);
  const key = await deriveSeedPassword(password, salt);
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
  if(process.env.NODE_ENV==="production" || process.env.DEALOS_ALLOW_DESTRUCTIVE_SEED!=="true"){
    throw new Error("Seed deletes all demo data. Set DEALOS_ALLOW_DESTRUCTIVE_SEED=true in a disposable local/CI database only.");
  }
  await prisma.walletTransaction.deleteMany();
  await prisma.walletAccount.deleteMany();
  await prisma.verificationEvidence.deleteMany();
  await prisma.acquisitionOffer.deleteMany();
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
      status: "PUBLISHED",
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
      buyerId: ids.buyer,
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

  const sampleRoot=resolve(process.env.DEALOS_PRIVATE_DOCUMENT_DIR || "../../.private/data-room");
  async function sampleDocument(listingId:string,category:string,name:string) {
    const storageKey=`${listingId}/${randomUUID()}`;
    const content=Buffer.from(`SIMULATED SAMPLE DATA ONLY\\nBusiness: ${listingId}\\nDocument: ${name}\\nNo real personal or financial information.\\n`);
    await mkdir(join(sampleRoot,listingId),{recursive:true,mode:0o700});
    await writeFile(join(sampleRoot,...storageKey.split("/")),content,{mode:0o600,flag:"wx"});
    return {listingId,name,category,objectKey:storageKey,contentType:"text/csv",sizeBytes:content.length};
  }
  await prisma.dataRoomDocument.createMany({data:[
    await sampleDocument(ids.listing,"Financial","Illustrative revenue.csv"),
    await sampleDocument(ids.listing,"Customers","Sample customer mix.csv"),
    await sampleDocument(ids.listing,"Legal","Illustrative IP checklist.csv"),
    await sampleDocument(ids.listing,"Technical","Sample infrastructure summary.csv"),
  ]});

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

  const count=Math.min(100,Math.max(10,Number(process.env.DEALOS_SEED_LISTING_COUNT)||10));
  const categories=["SaaS","E-commerce","Logistics","Health technology","Education technology","Fintech","Media","Analytics"];
  const names=["Lagoon Commerce","Abeokuta Cloud","Northern Dispatch","BrightCampus","Cedar Health","MarketPath","BluePalm Media","Bridge Analytics"];
  const samples=[];
  for(let i=1;i<count;i++){
    const serial=String(i).padStart(3,"0");
    const orgId=`50000000-0000-0000-0000-${String(i).padStart(12,"0")}`;
    const sellerId=`60000000-0000-0000-0000-${String(i).padStart(12,"0")}`;
    const listingId=`70000000-0000-0000-0000-${String(i).padStart(12,"0")}`;
    const name=`${names[(i-1)%names.length]} ${serial}`;
    await prisma.organization.create({data:{id:orgId,name:`${name} Ltd`,country:"Nigeria"}});
    await prisma.user.create({data:{
      id:sellerId,name:`Demo Seller ${serial}`,email:`seller${serial}@dealos.example`,
      passwordHash,role:UserRole.SELLER,organizationId:orgId,
      kycCase:{create:{country:"Nigeria",status:KycStatus.VERIFIED,identityVerified:true,businessVerified:true,revenueVerified:true,reviewedAt:new Date()}},
    }});
    const listing=await prisma.listing.create({data:{
      id:listingId,organizationId:orgId,name,slug:`sample-business-${serial}`,
      status:"PUBLISHED",category:categories[(i-1)%categories.length],country:"Nigeria",
      askingPriceMinor:BigInt(35_000_000+i*1_250_000)*100n,currency:"NGN",
      annualRevenueMinor:BigInt(12_000_000+i*325_000)*100n,
      recurringRevenuePct:40+i%55,customerConcentration:12+i%35,
      revenueTrendPct:(i%4===0?-5:8),ownerHoursPerWeek:10+i%25,
      ipAssigned:i%3!==0,litigationOpen:false,
    }});
    await prisma.dataRoomDocument.create({data:await sampleDocument(listing.id,"Financial",`Illustrative revenue ${serial}.csv`)});
    samples.push({listing,sellerId});
  }
  for(let i=0;i<Math.min(2,samples.length);i++){
    const sample=samples[i];
    await prisma.deal.create({data:{
      ref:`DL-2026-SAMPLE-${i+1}`,listingId:sample.listing.id,buyerId:ids.buyer,
      stage:i===0?DealStage.DILIGENCE:DealStage.NDA_PENDING,
      version:i===0?1:0,
      participants:{create:[
        {userId:ids.buyer,role:UserRole.BUYER},
        {userId:sample.sellerId,role:UserRole.SELLER},
        {userId:ids.advisor,role:UserRole.ADVISOR},
      ]},
      ndaAgreements:{create:{userId:ids.buyer,status:i===0?NdaStatus.SIGNED:NdaStatus.PENDING,version:"1.0",signedAt:i===0?new Date():null}},
    }});
  }
  console.log(`DealOS seeded ${count} sample businesses with ${Math.min(2,samples.length)+1} independent deals`);
}

main().finally(() => prisma.$disconnect());
