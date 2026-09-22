import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { DealStage, User, UserRole } from "@prisma/client";
import { transitionDealSchema } from "@dealos/contracts";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { serialize } from "../common/serialize";

import { canTransitionDeal } from "./deal-state";

@Injectable()
export class DealsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async assertParticipant(dealId: string, actor: User) {
    if (actor.role === UserRole.ADMIN) return;
    const participant = await this.prisma.dealParticipant.findUnique({
      where: { dealId_userId: { dealId, userId: actor.id } },
    });
    if (!participant) throw new ForbiddenException("You do not have access to this deal");
  }

  async list(actor: User) {
    const deals = await this.prisma.deal.findMany({
      where: actor.role === UserRole.ADMIN
        ? undefined
        : { participants: { some: { userId: actor.id } } },
      include: {
        listing: { include: { organization: true } },
        participants: { include: { user: { select: { id: true, name: true, role: true } } } },
        escrow: true,
        offer: true,
        findings: { where: { resolvedAt: null } },
      },
      orderBy: { updatedAt: "desc" },
      take: 100,
    });
    return serialize(deals);
  }

  async get(id: string, actor: User) {
    await this.assertParticipant(id, actor);
    const deal = await this.prisma.deal.findUnique({
      where: { id },
      include: {
        listing: { include: { organization: true } },
        participants: { include: { user: { select: { id: true, name: true, role: true } } } },
        ndaAgreements: true,
        escrow: true,
        offer: true,
        findings: { where: { resolvedAt: null }, orderBy: { createdAt: "desc" } },
        questions: { orderBy: { createdAt: "asc" } },
        assetItems: { orderBy: { createdAt: "asc" } },
        auditEvents: {
          include: { actor: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: "desc" },
          take: 50,
        },
      },
    });
    if (!deal) throw new NotFoundException("Deal not found");
    return serialize(deal);
  }

  async signNda(id: string, actor: User) {
    await this.assertParticipant(id, actor);
    if (actor.role !== UserRole.BUYER) throw new ForbiddenException("Only the buyer can sign this NDA");
    const correlationId = randomUUID();

    const result = await this.prisma.$transaction(async (tx) => {
      const deal = await tx.deal.findUnique({ where: { id } });
      if (!deal) throw new NotFoundException("Deal not found");
      if (deal.stage !== DealStage.NDA_PENDING) {
        const signed = await tx.ndaAgreement.findUnique({
          where: { dealId_userId: { dealId: id, userId: actor.id } },
        });
        if (signed?.status === "SIGNED" && deal.stage !== DealStage.WITHDRAWN) return signed;
        throw new ConflictException("This acquisition is no longer awaiting an NDA");
      }
      const previouslySigned = await tx.ndaAgreement.findUnique({
        where: { dealId_userId: { dealId: id, userId: actor.id } },
      });
      if (previouslySigned?.status === "SIGNED") return previouslySigned;

      const nda = await tx.ndaAgreement.upsert({
        where: { dealId_userId: { dealId: id, userId: actor.id } },
        create: { dealId: id, userId: actor.id, version: "4.2", status: "SIGNED", signedAt: new Date() },
        update: { status: "SIGNED", signedAt: new Date() },
      });

      if (deal.stage === DealStage.NDA_PENDING) {
        await tx.deal.update({
          where: { id },
          data: { stage: DealStage.DILIGENCE, version: { increment: 1 } },
        });
      }

      await this.audit.create({
        dealId: id,
        actor,
        resourceType: "NDA",
        resourceId: nda.id,
        action: "NDA_SIGNED",
        previousState: deal.stage,
        nextState: deal.stage === DealStage.NDA_PENDING ? DealStage.DILIGENCE : deal.stage,
        metadata: { version: nda.version },
        correlationId,
      }, tx);

      await tx.outboxEvent.create({
        data: {
          topic: "deal.nda_signed",
          aggregateId: id,
          payload: { dealId: id, buyerId: actor.id, correlationId },
        },
      });

      return nda;
    });

    return serialize(result);
  }

  async transition(id: string, actor: User, payload: unknown) {
    if (!([UserRole.ADVISOR, UserRole.ADMIN] as UserRole[]).includes(actor.role)) {
      throw new ForbiddenException("Only a deal advisor can move the pipeline");
    }
    await this.assertParticipant(id, actor);
    const input = transitionDealSchema.parse(payload);
    const correlationId = randomUUID();

    return this.prisma.$transaction(async (tx) => {
      const deal = await tx.deal.findUnique({ where: { id } });
      if (!deal) throw new NotFoundException("Deal not found");
      if (deal.version !== input.expectedVersion) {
        throw new ConflictException({
          message: "Deal changed while you were viewing it",
          currentVersion: deal.version,
          currentStage: deal.stage,
        });
      }
      if(input.to===DealStage.LOI || input.to===DealStage.DILIGENCE || input.to===DealStage.COMPLETED) {
        throw new ConflictException("NDA, offers and completion have their own approval actions");
      }
      if(input.to===DealStage.FULL_DILIGENCE) {
        const offer=await tx.acquisitionOffer.findUnique({where:{dealId:id}});
        if(offer?.status!=="ACCEPTED") throw new ConflictException("The seller must accept an offer first");
      }
      if(input.to===DealStage.ESCROW) {
        const escrow=await tx.escrowAccount.findUnique({where:{dealId:id}});
        if(!escrow || escrow.status!=="CREATED") throw new ConflictException("An accepted offer and escrow account are required");
        const parties=await tx.dealParticipant.findMany({where:{dealId:id,role:{in:[UserRole.BUYER,UserRole.SELLER]}}});
        const cases=await tx.kycCase.findMany({where:{userId:{in:parties.map(p=>p.userId)}}});
        if(parties.length!==2 || cases.length!==2 || cases.some(k=>!k.identityVerified) ||
          !cases.some(k=>k.businessVerified && k.revenueVerified)) {
          throw new ConflictException("Both parties must complete required demo verification");
        }
      }
      if(input.to===DealStage.ASSET_TRANSFER) {
        const escrow=await tx.escrowAccount.findUnique({where:{dealId:id}});
        if(escrow?.status!=="FUNDED") throw new ConflictException("Simulated escrow funding is required before asset transfer");
      }
      if (!canTransitionDeal(deal.stage, input.to as DealStage)) {
        throw new ConflictException(`Cannot move deal from ${deal.stage} to ${input.to}`);
      }

      const updated = await tx.deal.updateMany({
        where: { id, version: input.expectedVersion },
        data: { stage: input.to as DealStage, version: { increment: 1 } },
      });
      if (updated.count !== 1) throw new ConflictException("Concurrent deal update detected");

      await this.audit.create({
        dealId: id,
        actor,
        resourceType: "DEAL",
        resourceId: id,
        action: "DEAL_STAGE_CHANGED",
        previousState: deal.stage,
        nextState: input.to,
        metadata: { note: input.note ?? null },
        correlationId,
      }, tx);

      await tx.outboxEvent.create({
        data: {
          topic: "deal.stage_changed",
          aggregateId: id,
          payload: { dealId: id, from: deal.stage, to: input.to, correlationId },
        },
      });

      return serialize(await tx.deal.findUniqueOrThrow({ where: { id } }));
    });
  }

  async confirmAsset(dealId:string,itemId:string,actor:User) {
    if(!(actor.role === UserRole.BUYER || actor.role === UserRole.SELLER)) throw new ForbiddenException("Buyer or seller account required");
    await this.assertParticipant(dealId,actor);
    const deal=await this.prisma.deal.findUnique({where:{id:dealId}});
    if(!deal || deal.stage!==DealStage.ASSET_TRANSFER) throw new ConflictException("The deal must be in asset transfer");
    const field=actor.role===UserRole.BUYER?"buyerDone":"sellerDone";
    const result=await this.prisma.$transaction(async tx=>{
      const changed=await tx.assetTransferItem.updateMany({
        where:{id:itemId,dealId,[field]:false},
        data:{[field]:true},
      });
      if(changed.count===0){
        const current=await tx.assetTransferItem.findFirst({where:{id:itemId,dealId}});
        if(!current) throw new NotFoundException("Asset transfer item not found");
        return current;
      }
      let item=await tx.assetTransferItem.findUniqueOrThrow({where:{id:itemId}});
      if(item.buyerDone && item.sellerDone){
        item=await tx.assetTransferItem.update({where:{id:itemId},data:{completedAt:new Date()}});
      }
      await tx.auditEvent.create({data:{
        dealId,actorId:actor.id,resourceType:"ASSET_TRANSFER",resourceId:itemId,
        action:"ASSET_TRANSFER_CONFIRMED",metadata:{party:actor.role,label:item.label},correlationId:randomUUID(),
      }});
      return item;
    });
    return serialize(result);
  }

  async assertCanStream(id: string, actor: User) {
    await this.assertParticipant(id, actor);
  }
}
