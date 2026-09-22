import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { sellerDiligenceAnswerSchema } from "@dealos/contracts";
import { FindingSeverity, Prisma, User, UserRole } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { serialize } from "../common/serialize";

type RuleResult = {
  code: string;
  title: string;
  severity: FindingSeverity;
  detail: string;
  evidence: Prisma.InputJsonValue;
  question: string;
};

@Injectable()
export class DiligenceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  private async getAuthorizedDeal(dealId: string, actor: User) {
    const deal = await this.prisma.deal.findUnique({
      where: { id: dealId },
      include: { listing: true, participants: true },
    });
    if (!deal) throw new NotFoundException("Deal not found");
    const participant = deal.participants.some((p) => p.userId === actor.id);
    if (actor.role !== UserRole.ADMIN && !participant) {
      throw new ForbiddenException("You do not have access to this deal");
    }
    return deal;
  }

  private evaluate(listing: {
    customerConcentration: number;
    revenueTrendPct: number;
    ownerHoursPerWeek: number;
    recurringRevenuePct: number;
    ipAssigned: boolean;
    litigationOpen: boolean;
  }): RuleResult[] {
    const results: RuleResult[] = [];
    if (listing.customerConcentration > 30) {
      results.push({
        code: "CUSTOMER_CONCENTRATION",
        title: "Customer concentration above threshold",
        severity: FindingSeverity.HIGH,
        detail: `The largest customer represents ${listing.customerConcentration}% of annual revenue.`,
        evidence: { concentrationPct: listing.customerConcentration, thresholdPct: 30 },
        question: "What are the renewal, termination, and pricing terms for the largest customer, and how replaceable is that revenue?",
      });
    }
    if (listing.revenueTrendPct < 0) {
      results.push({
        code: "REVENUE_TREND",
        title: "Recent revenue decline",
        severity: listing.revenueTrendPct <= -15 ? FindingSeverity.HIGH : FindingSeverity.MEDIUM,
        detail: `Revenue is down ${Math.abs(listing.revenueTrendPct)}% across the latest comparison period.`,
        evidence: { trendPct: listing.revenueTrendPct },
        question: "Which cohorts, products, or customers explain the decline, and what has happened since the reporting period ended?",
      });
    }
    if (listing.ownerHoursPerWeek > 25) {
      results.push({
        code: "OWNER_DEPENDENCY",
        title: "Material owner dependency",
        severity: FindingSeverity.MEDIUM,
        detail: `The owner reports ${listing.ownerHoursPerWeek} operating hours per week.`,
        evidence: { ownerHoursPerWeek: listing.ownerHoursPerWeek },
        question: "Which recurring responsibilities still depend on the owner, and what transition plan transfers those responsibilities?",
      });
    }
    if (!listing.ipAssigned) {
      results.push({
        code: "IP_ASSIGNMENT",
        title: "IP assignment needs confirmation",
        severity: FindingSeverity.HIGH,
        detail: "Not all contributor IP has been confirmed as assigned to the company.",
        evidence: { ipAssigned: listing.ipAssigned },
        question: "Can you provide signed IP assignment agreements for all employees and contractors who contributed to the product?",
      });
    }
    if (listing.litigationOpen) {
      results.push({
        code: "OPEN_LITIGATION",
        title: "Open litigation disclosed",
        severity: FindingSeverity.CRITICAL,
        detail: "The seller has disclosed unresolved litigation.",
        evidence: { litigationOpen: true },
        question: "Please provide counsel's summary of the claim, possible exposure, current procedural stage, and expected resolution timeline.",
      });
    }
    if (listing.recurringRevenuePct < 40) {
      results.push({
        code: "LOW_RECURRING_REVENUE",
        title: "Low recurring revenue mix",
        severity: FindingSeverity.LOW,
        detail: `Only ${listing.recurringRevenuePct}% of revenue is recurring.`,
        evidence: { recurringRevenuePct: listing.recurringRevenuePct },
        question: "What portion of non-recurring revenue repeats in practice, and which products could move to subscription or contracted terms?",
      });
    }
    return results;
  }

  async get(dealId: string, actor: User) {
    await this.getAuthorizedDeal(dealId, actor);
    const [findings, questions] = await Promise.all([
      this.prisma.dueDiligenceFinding.findMany({ where: { dealId }, orderBy: { createdAt: "desc" } }),
      this.prisma.dueDiligenceQuestion.findMany({ where: { dealId }, orderBy: { createdAt: "asc" } }),
    ]);
    return serialize({ findings, questions });
  }

  async answer(dealId: string, questionId: string, actor: User, payload: unknown) {
    const deal = await this.getAuthorizedDeal(dealId, actor);
    if (actor.role !== UserRole.SELLER || deal.listing.organizationId !== actor.organizationId) {
      throw new ForbiddenException("Only this business's seller can answer diligence questions");
    }
    if (deal.stage !== "DILIGENCE" && deal.stage !== "FULL_DILIGENCE") {
      throw new ConflictException("Diligence questions are not open at this transaction stage");
    }
    const input = sellerDiligenceAnswerSchema.parse(payload);
    return this.prisma.$transaction(async tx => {
      const question = await tx.dueDiligenceQuestion.findFirst({
        where: { id: questionId, dealId },
      });
      if (!question) throw new NotFoundException("Diligence question not found");
      const updated = await tx.dueDiligenceQuestion.update({
        where: { id: questionId }, data: { answer: input.answer },
      });
      await this.audit.create({
        dealId, actor, resourceType: "DUE_DILIGENCE_QUESTION", resourceId: questionId,
        action: "SELLER_ANSWERED_QUESTION",
        metadata: { summary: "Seller provided a diligence response" },
        correlationId: randomUUID(),
      }, tx);
      await tx.outboxEvent.create({
        data: { topic: "diligence.question_answered", aggregateId: dealId,
          payload: { dealId, questionId } },
      });
      return serialize(updated);
    });
  }

  async run(dealId: string, actor: User) {
    const deal = await this.getAuthorizedDeal(dealId, actor);
    if (actor.role !== UserRole.ADVISOR && actor.role !== UserRole.ADMIN) {
      throw new ForbiddenException("Only a deal advisor can run the diligence review");
    }
    if (deal.stage === "WITHDRAWN") throw new ConflictException("This acquisition has ended");
    const results = this.evaluate(deal.listing);
    const correlationId = randomUUID();

    await this.prisma.$transaction(async (tx) => {
      for (const result of results) {
        const finding = await tx.dueDiligenceFinding.upsert({
          where: { dealId_code: { dealId, code: result.code } },
          create: {
            dealId,
            code: result.code,
            title: result.title,
            severity: result.severity,
            detail: result.detail,
            evidence: result.evidence,
          },
          update: {
            title: result.title,
            severity: result.severity,
            detail: result.detail,
            evidence: result.evidence,
            resolvedAt: null,
          },
        });
        const exists = await tx.dueDiligenceQuestion.findFirst({
          where: { dealId, findingId: finding.id, question: result.question },
        });
        if (!exists) {
          await tx.dueDiligenceQuestion.create({
            data: { dealId, findingId: finding.id, question: result.question },
          });
        }
      }

      await this.audit.create({
        dealId,
        actor,
        resourceType: "DUE_DILIGENCE",
        resourceId: dealId,
        action: "DILIGENCE_RULES_RUN",
        metadata: { findingCount: results.length },
        correlationId,
      }, tx);

      await tx.outboxEvent.create({
        data: {
          topic: "diligence.completed",
          aggregateId: dealId,
          payload: { dealId, findingCount: results.length, correlationId },
        },
      });
    });

    return this.get(dealId, actor);
  }
}
