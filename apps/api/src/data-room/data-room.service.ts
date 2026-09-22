import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { NdaStatus, User, UserRole } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { serialize } from "../common/serialize";

@Injectable()
export class DataRoomService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async accessContext(dealId: string, actor: User) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: { listing: true, participants: true, ndaAgreements: true },
    });
    if (!deal) throw new NotFoundException("Deal not found");

    const participant = deal.participants.some((p) => p.userId === actor.id);
    if (!([UserRole.ADVISOR, UserRole.ADMIN] as UserRole[]).includes(actor.role) && !participant) {
      throw new ForbiddenException("You do not have access to this deal");
    }

    const ndaSigned = deal.ndaAgreements.some(
      (nda) => nda.userId === actor.id && nda.status === NdaStatus.SIGNED,
    );
    const privileged = ([UserRole.ADVISOR, UserRole.ADMIN, UserRole.SELLER] as UserRole[]).includes(actor.role);
    return { deal, allowed: privileged || ndaSigned, ndaSigned };
  }

  async list(dealId: string, actor: User) {
    const { deal, allowed } = await this.accessContext(dealId, actor);
    if (!allowed) throw new ForbiddenException("A signed NDA is required before entering the data room");
    const docs = await this.prisma.dataRoomDocument.findMany({
      where: { listingId: deal.listingId, active: true },
      select: { id: true, name: true, category: true, contentType: true, sizeBytes: true, createdAt: true },
      orderBy: [{ category: "asc" }, { name: "asc" }],
    });
    return serialize(docs);
  }

  async access(documentId: string, dealId: string, actor: User) {
    const correlationId = randomUUID();
    const document = await this.prisma.dataRoomDocument.findUnique({ where: { id: documentId } });
    if (!document) throw new NotFoundException("Document not found");

    let allowed = false;
    let reason: string | null = null;
    try {
      const context = await this.accessContext(dealId, actor);
      allowed = context.allowed && context.deal.listingId === document.listingId && document.active;
      if (!allowed) reason = "NDA or listing access policy denied the request";
    } catch (error) {
      reason = error instanceof Error ? error.message : "Access denied";
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.dataRoomAccess.create({
        data: { documentId, userId: actor.id, dealId, allowed, reason },
      });
      await this.audit.create({
        dealId,
        actor,
        resourceType: "DATA_ROOM_DOCUMENT",
        resourceId: documentId,
        action: allowed ? "DOCUMENT_OPENED" : "DOCUMENT_ACCESS_DENIED",
        metadata: { name: document.name, reason },
        correlationId,
      }, tx);
    });

    if (!allowed) throw new ForbiddenException(reason ?? "Document access denied");

    return {
      document: { id: document.id, name: document.name },
      signedUrl: `https://documents.example.invalid/${encodeURIComponent(document.objectKey)}?demo=1`,
      expiresInSeconds: 300,
    };
  }
}
