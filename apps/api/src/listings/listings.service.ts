import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { User, UserRole } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { serialize } from "../common/serialize";

@Injectable()
export class ListingsService {
  constructor(private readonly prisma: PrismaService) {}

  async list() {
    const listings = await this.prisma.listing.findMany({
      select: {
        id: true,
        slug: true,
        name: true,
        category: true,
        askingPriceMinor: true,
        annualRevenueMinor: true,
        recurringRevenuePct: true,
        createdAt: true,
        organization: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return serialize(listings);
  }

  async get(slug: string) {
    const listing = await this.prisma.listing.findUnique({
      where: { slug },
      select: {
        id: true,
        slug: true,
        name: true,
        category: true,
        askingPriceMinor: true,
        annualRevenueMinor: true,
        recurringRevenuePct: true,
        customerConcentration: true,
        ownerHoursPerWeek: true,
        createdAt: true,
        organization: { select: { name: true } },
      },
    });
    if (!listing) throw new NotFoundException("Listing not found");
    return serialize(listing);
  }

  async startDeal(slug: string, actor: User) {
    if (actor.role !== UserRole.BUYER) {
      throw new ForbiddenException("Only buyer accounts can start an acquisition");
    }

    const listing = await this.prisma.listing.findUnique({
      where: { slug },
      include: {
        organization: {
          include: {
            users: {
              where: { role: UserRole.SELLER },
              orderBy: { createdAt: "asc" },
              take: 1,
            },
          },
        },
      },
    });
    if (!listing) throw new NotFoundException("Listing not found");

    const existing = await this.prisma.deal.findFirst({
      where: {
        listingId: listing.id,
        participants: { some: { userId: actor.id } },
        stage: { notIn: ["COMPLETED", "WITHDRAWN"] },
      },
      orderBy: { createdAt: "desc" },
    });
    if (existing) return serialize(existing);

    const seller = listing.organization.users[0];
    if (!seller) throw new NotFoundException("Seller account not found for this listing");

    const advisor = await this.prisma.user.findFirst({
      where: { role: { in: [UserRole.ADVISOR, UserRole.ADMIN] } },
      orderBy: { createdAt: "asc" },
    });
    if (!advisor) throw new NotFoundException("Deal advisor is not configured");

    const suffix = randomUUID().replaceAll("-", "").slice(0, 8).toUpperCase();
    const ref = `DL-${new Date().getFullYear()}-${suffix}`;

    const deal = await this.prisma.$transaction(async (tx) => {
      const created = await tx.deal.create({
        data: {
          ref,
          listingId: listing.id,
          stage: "NDA_PENDING",
          participants: {
            create: [
              { userId: actor.id, role: UserRole.BUYER },
              { userId: seller.id, role: UserRole.SELLER },
              { userId: advisor.id, role: advisor.role },
            ],
          },
          ndaAgreements: {
            create: {
              userId: actor.id,
              version: "4.2",
              status: "PENDING",
            },
          },
        },
      });

      const correlationId = randomUUID();
      await tx.auditEvent.create({
        data: {
          dealId: created.id,
          actorId: actor.id,
          resourceType: "DEAL",
          resourceId: created.id,
          action: "DEAL_CREATED",
          nextState: "NDA_PENDING",
          metadata: { summary: `Buyer opened an acquisition for ${listing.name}` },
          correlationId,
        },
      });
      await tx.outboxEvent.create({
        data: {
          topic: "deal.created",
          aggregateId: created.id,
          payload: { dealId: created.id, buyerId: actor.id, listingId: listing.id, correlationId },
        },
      });

      return created;
    });

    return serialize(deal);
  }
}
