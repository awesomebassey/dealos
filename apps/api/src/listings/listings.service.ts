import { Injectable, NotFoundException } from "@nestjs/common";
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
}
