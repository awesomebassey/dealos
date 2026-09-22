import { Injectable } from "@nestjs/common";
import { Prisma, User } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

export type AuditInput = {
  dealId?: string;
  actor?: User | null;
  resourceType: string;
  resourceId: string;
  action: string;
  previousState?: string | null;
  nextState?: string | null;
  metadata?: Prisma.InputJsonValue;
  correlationId: string;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  create(input: AuditInput, tx: Prisma.TransactionClient = this.prisma) {
    return tx.auditEvent.create({
      data: {
        dealId: input.dealId,
        actorId: input.actor?.id,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
        action: input.action,
        previousState: input.previousState,
        nextState: input.nextState,
        metadata: input.metadata ?? {},
        correlationId: input.correlationId,
      },
    });
  }

  listForDeal(dealId: string, after?: Date) {
    return this.prisma.auditEvent.findMany({
      where: { dealId, ...(after ? { createdAt: { gt: after } } : {}) },
      include: { actor: { select: { id: true, name: true, role: true } } },
      orderBy: { createdAt: "asc" },
      take: 100,
    });
  }
}
