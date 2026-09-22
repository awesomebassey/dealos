import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import {
  DealStage,
  EscrowStatus,
  EscrowTxStatus,
  EscrowTxType,
  LedgerDirection,
  User,
  UserRole,
  WalletDirection,
  WalletTxType,
  ListingStatus,
} from "@prisma/client";
import { fundEscrowSchema, signOffSchema } from "@dealos/contracts";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { serialize } from "../common/serialize";
import { stableHash } from "../common/hash";
import { escrowReleaseBlocker } from "./escrow-policy";

@Injectable()
export class EscrowService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async dealContext(dealId: string, actor: User) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: { escrow: true, participants: true },
    });
    if (!deal || !deal.escrow) throw new NotFoundException("Escrow account not found");
    const participant = deal.participants.some((p) => p.userId === actor.id);
    if (!([UserRole.ADVISOR, UserRole.ADMIN] as UserRole[]).includes(actor.role) && !participant) {
      throw new ForbiddenException("You do not have access to this escrow");
    }
    return deal;
  }

  async get(dealId: string, actor: User) {
    await this.dealContext(dealId, actor);
    const escrow = await this.prisma.escrowAccount.findUniqueOrThrow({
      where: { dealId },
      include: {
        transactions: { orderBy: { createdAt: "desc" } },
        ledgerEntries: { orderBy: { createdAt: "asc" } },
      },
    });
    return serialize(escrow);
  }

  async fund(dealId: string, actor: User, payload: unknown, idempotencyKey?: string) {
    if (actor.role !== UserRole.BUYER) throw new ForbiddenException("Only the buyer can fund escrow");
    if (!idempotencyKey) throw new ConflictException("Idempotency-Key header is required");
    const input = fundEscrowSchema.parse(payload);
    const requestHash = stableHash(input);
    const scope = `escrow:fund:${dealId}`;
    const correlationId = randomUUID();
    const context = await this.dealContext(dealId, actor);
    if (context.buyerId !== actor.id) throw new ForbiddenException("Only this deal's buyer can fund escrow");
    if (process.env.DEALOS_DEMO_FINANCE_ENABLED !== "true") throw new ForbiddenException("Simulated funding is disabled");
    const kyc = await this.prisma.kycCase.findUnique({where:{userId:actor.id}});
    if (!kyc?.identityVerified) throw new ForbiddenException("Complete demo identity verification first");

    if (!([DealStage.ESCROW, DealStage.ASSET_TRANSFER] as DealStage[]).includes(context.stage)) {
      throw new ConflictException("Deal must be in escrow before funding");
    }

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.idempotencyRecord.findUnique({
        where: { scope_key: { scope, key: idempotencyKey } },
      });
      if (existing) {
        if (existing.requestHash !== requestHash) {
          throw new ConflictException("Idempotency key was already used for a different request");
        }
        if (!existing.resultId) throw new ConflictException("Original funding request is still incomplete");
        return serialize(await tx.escrowTransaction.findUniqueOrThrow({ where: { id: existing.resultId } }));
      }

      const escrow = await tx.escrowAccount.findUniqueOrThrow({ where: { dealId } });
      if (escrow.status !== EscrowStatus.CREATED && escrow.status !== EscrowStatus.FUNDING_PENDING) {
        throw new ConflictException(`Escrow cannot be funded from ${escrow.status}`);
      }
      if (BigInt(input.amountMinor) !== escrow.amountMinor) {
        throw new ConflictException("Funding amount must match the agreed escrow amount");
      }

      const claimed=await tx.escrowAccount.updateMany({
        where:{id:escrow.id,status:escrow.status},
        data:{status:EscrowStatus.FUNDED},
      });
      if(claimed.count!==1) throw new ConflictException("Escrow was funded by another request");
      const wallet=await tx.walletAccount.findUnique({where:{userId:actor.id}});
      if(!wallet) throw new ConflictException("Create and fund your demo wallet first");
      const debited=await tx.walletAccount.updateMany({
        where:{id:wallet.id,balanceMinor:{gte:escrow.amountMinor}},
        data:{balanceMinor:{decrement:escrow.amountMinor}},
      });
      if(debited.count!==1) throw new ConflictException("Insufficient demo wallet balance");
      await tx.walletTransaction.create({data:{
        walletId:wallet.id,dealId,direction:WalletDirection.DEBIT,
        type:WalletTxType.ESCROW_FUNDING,amountMinor:escrow.amountMinor,
        idempotencyKey:`escrow-fund:${dealId}`,
      }});
      await tx.idempotencyRecord.create({ data: { scope, key: idempotencyKey, requestHash } });
      const transaction = await tx.escrowTransaction.create({
        data: {
          escrowAccountId: escrow.id,
          type: EscrowTxType.FUND,
          status: EscrowTxStatus.SETTLED,
          amountMinor: escrow.amountMinor,
          currency: escrow.currency,
          provider: input.provider,
          providerRef: `demo_${input.provider.toLowerCase()}_${randomUUID()}`,
          idempotencyKey,
          settledAt: new Date(),
        },
      });

      await tx.ledgerEntry.createMany({
        data: [
          {
            escrowAccountId: escrow.id,
            transactionId: transaction.id,
            account: "CASH_CLEARING",
            direction: LedgerDirection.DEBIT,
            amountMinor: escrow.amountMinor,
            currency: escrow.currency,
          },
          {
            escrowAccountId: escrow.id,
            transactionId: transaction.id,
            account: "ESCROW_LIABILITY",
            direction: LedgerDirection.CREDIT,
            amountMinor: escrow.amountMinor,
            currency: escrow.currency,
          },
        ],
      });

      await tx.idempotencyRecord.update({
        where: { scope_key: { scope, key: idempotencyKey } },
        data: { resultId: transaction.id },
      });
      await this.audit.create({
        dealId,
        actor,
        resourceType: "ESCROW",
        resourceId: escrow.id,
        action: "ESCROW_FUNDED",
        previousState: escrow.status,
        nextState: EscrowStatus.FUNDED,
        metadata: { amountMinor: escrow.amountMinor.toString(), provider: input.provider },
        correlationId,
      }, tx);
      await tx.outboxEvent.create({
        data: {
          topic: "escrow.funded",
          aggregateId: dealId,
          payload: { dealId, transactionId: transaction.id, correlationId },
        },
      });

      return serialize(transaction);
    });
  }

  async signOff(dealId: string, actor: User, payload: unknown) {
    const input = signOffSchema.parse(payload);
    const context = await this.dealContext(dealId, actor);
    if (context.stage !== DealStage.ASSET_TRANSFER) throw new ConflictException("Start asset transfer before confirming completion");
    const items=await this.prisma.assetTransferItem.findMany({where:{dealId}});
    if(!items.length || items.some(item=>!item.buyerDone || !item.sellerDone)) {
      throw new ConflictException("Both parties must complete every asset-transfer item first");
    }
    const expectedRole = input.party === "BUYER" ? UserRole.BUYER : UserRole.SELLER;
    if (actor.role !== expectedRole) throw new ForbiddenException(`Only the ${input.party.toLowerCase()} can sign this confirmation`);
    if (!([EscrowStatus.FUNDED, EscrowStatus.TRANSFER_IN_PROGRESS, EscrowStatus.VERIFICATION, EscrowStatus.RELEASE_PENDING] as EscrowStatus[]).includes(context.escrow!.status)) {
      throw new ConflictException("Escrow is not ready for completion sign-off");
    }

    const correlationId = randomUUID();
    await this.prisma.$transaction(async (tx) => {
      const escrow = await tx.escrowAccount.findUniqueOrThrow({ where: { dealId } });
      const now = new Date();
      const buyerSignedOffAt = input.party === "BUYER" ? now : escrow.buyerSignedOffAt;
      const sellerSignedOffAt = input.party === "SELLER" ? now : escrow.sellerSignedOffAt;
      const nextStatus = buyerSignedOffAt && sellerSignedOffAt
        ? EscrowStatus.RELEASE_PENDING
        : EscrowStatus.VERIFICATION;

      await tx.escrowAccount.update({
        where: { id: escrow.id },
        data: {
          buyerSignedOffAt,
          sellerSignedOffAt,
          status: nextStatus,
        },
      });
      await this.audit.create({
        dealId,
        actor,
        resourceType: "ESCROW",
        resourceId: escrow.id,
        action: "COMPLETION_SIGNED",
        previousState: escrow.status,
        nextState: nextStatus,
        metadata: { party: input.party },
        correlationId,
      }, tx);
    });

    return this.get(dealId, actor);
  }

  async platformConfirm(dealId: string, actor: User) {
    if (!([UserRole.ADVISOR, UserRole.ADMIN] as UserRole[]).includes(actor.role)) {
      throw new ForbiddenException("Platform confirmation requires an advisor");
    }
    const context = await this.dealContext(dealId, actor);
    if (!context.escrow!.buyerSignedOffAt || !context.escrow!.sellerSignedOffAt) {
      throw new ConflictException("Both parties must sign before platform confirmation");
    }
    const correlationId = randomUUID();
    await this.prisma.$transaction(async (tx) => {
      const escrow = await tx.escrowAccount.update({
        where: { dealId },
        data: { platformConfirmedAt: new Date(), status: EscrowStatus.RELEASE_PENDING },
      });
      await this.audit.create({
        dealId,
        actor,
        resourceType: "ESCROW",
        resourceId: escrow.id,
        action: "PLATFORM_RELEASE_CONFIRMED",
        nextState: EscrowStatus.RELEASE_PENDING,
        correlationId,
      }, tx);
    });
    return this.get(dealId, actor);
  }

  async release(dealId: string, actor: User, idempotencyKey?: string) {
    if (!([UserRole.ADVISOR, UserRole.ADMIN] as UserRole[]).includes(actor.role)) {
      throw new ForbiddenException("Escrow release requires an advisor");
    }
    if (!idempotencyKey) throw new ConflictException("Idempotency-Key header is required");
    const scope = `escrow:release:${dealId}`;
    const requestHash = stableHash({ dealId, action: "release" });
    const correlationId = randomUUID();
    await this.dealContext(dealId, actor);

    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.idempotencyRecord.findUnique({
        where: { scope_key: { scope, key: idempotencyKey } },
      });
      if (existing) {
        if (existing.requestHash !== requestHash) throw new ConflictException("Idempotency key conflict");
        if (!existing.resultId) throw new ConflictException("Original release request is still incomplete");
        return serialize(await tx.escrowTransaction.findUniqueOrThrow({ where: { id: existing.resultId } }));
      }

      const escrow = await tx.escrowAccount.findUniqueOrThrow({ where: { dealId } });
      const blocker = escrowReleaseBlocker(escrow);
      if (blocker) throw new ConflictException(blocker);
      const deal=await tx.deal.findUniqueOrThrow({where:{id:dealId},include:{participants:true}});
      const assets=await tx.assetTransferItem.findMany({where:{dealId}});
      if(deal.stage!==DealStage.ASSET_TRANSFER || !assets.length || assets.some(a=>!a.buyerDone || !a.sellerDone)) {
        throw new ConflictException("Asset transfer must be confirmed before release");
      }
      const seller=deal.participants.find(p=>p.role===UserRole.SELLER);
      if(!seller) throw new ConflictException("Seller not found");
      const claimed=await tx.escrowAccount.updateMany({
        where:{id:escrow.id,status:EscrowStatus.RELEASE_PENDING},
        data:{status:EscrowStatus.RELEASED},
      });
      if(claimed.count!==1) throw new ConflictException("Escrow release is already in progress");
      await tx.idempotencyRecord.create({ data: { scope, key: idempotencyKey, requestHash } });
      const transaction = await tx.escrowTransaction.create({
        data: {
          escrowAccountId: escrow.id,
          type: EscrowTxType.RELEASE,
          status: EscrowTxStatus.SETTLED,
          amountMinor: escrow.amountMinor,
          currency: escrow.currency,
          provider: "PLATFORM",
          providerRef: `demo_release_${randomUUID()}`,
          idempotencyKey,
          settledAt: new Date(),
        },
      });
      await tx.ledgerEntry.createMany({
        data: [
          {
            escrowAccountId: escrow.id,
            transactionId: transaction.id,
            account: "ESCROW_LIABILITY",
            direction: LedgerDirection.DEBIT,
            amountMinor: escrow.amountMinor,
            currency: escrow.currency,
          },
          {
            escrowAccountId: escrow.id,
            transactionId: transaction.id,
            account: "SELLER_PAYABLE",
            direction: LedgerDirection.CREDIT,
            amountMinor: escrow.amountMinor,
            currency: escrow.currency,
          },
        ],
      });
      const sellerWallet=await tx.walletAccount.upsert({where:{userId:seller.userId},create:{userId:seller.userId},update:{}});
      await tx.walletAccount.update({where:{id:sellerWallet.id},data:{balanceMinor:{increment:escrow.amountMinor}}});
      await tx.walletTransaction.create({data:{
        walletId:sellerWallet.id,dealId,direction:WalletDirection.CREDIT,type:WalletTxType.ESCROW_RELEASE,
        amountMinor:escrow.amountMinor,idempotencyKey:`escrow-release:${dealId}`,
      }});
      await tx.listing.update({where:{id:deal.listingId},data:{status:ListingStatus.SOLD}});
      await tx.deal.update({ where: { id: dealId }, data: { stage: DealStage.COMPLETED, version: { increment: 1 } } });
      await tx.idempotencyRecord.update({ where: { scope_key: { scope, key: idempotencyKey } }, data: { resultId: transaction.id } });
      await this.audit.create({
        dealId,
        actor,
        resourceType: "ESCROW",
        resourceId: escrow.id,
        action: "ESCROW_RELEASED",
        previousState: escrow.status,
        nextState: EscrowStatus.RELEASED,
        metadata: { amountMinor: escrow.amountMinor.toString() },
        correlationId,
      }, tx);
      await tx.outboxEvent.create({
        data: { topic: "escrow.released", aggregateId: dealId, payload: { dealId, transactionId: transaction.id, correlationId } },
      });

      return serialize(transaction);
    });
  }
}
