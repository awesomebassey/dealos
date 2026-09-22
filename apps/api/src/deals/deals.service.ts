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
    if (([UserRole.ADVISOR, UserRole.ADMIN] as UserRole[]).includes(actor.role)) return;
    const participant = await this.prisma.dealParticipant.findUnique({
      where: { dealId_userId: { dealId, userId: actor.id } },
    });
    if (!participant) throw new ForbiddenException("You do not have access to this deal");
  }

  async list(actor: User) {
    const deals = await this.prisma.deal.findMany({
      where: ([UserRole.ADVISOR, UserRole.ADMIN] as UserRole[]).includes(actor.role)
        ? undefined
        : { participants: { some: { userId: actor.id } } },
      include: {
        listing: { include: { organization: true } },
        participants: { include: { user: { select: { id: true, name: true, role: true } } } },
        escrow: true,
        findings: { where: { resolvedAt: null } },
      },
      orderBy: { updatedAt: "desc" },
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

  async assertCanStream(id: string, actor: User) {
    await this.assertParticipant(id, actor);
  }
}
