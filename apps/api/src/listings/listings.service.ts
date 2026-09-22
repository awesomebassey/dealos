import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { ListingStatus, Prisma, User, UserRole } from "@prisma/client";
import { createListingSchema } from "@dealos/contracts";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { serialize } from "../common/serialize";

@Injectable()
export class ListingsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: { page?:string; q?:string; category?:string }) {
    const page = Math.min(Math.max(Number(query.page) || 1, 1), 10000);
    const pageSize = 12;
    const q = query.q?.trim().slice(0, 80);
    const category = query.category?.trim().slice(0, 80);
    const where: Prisma.ListingWhereInput = {
      status: ListingStatus.PUBLISHED,
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { category: { contains: q, mode: "insensitive" } }] } : {}),
      ...(category ? { category: { equals: category, mode: "insensitive" } } : {}),
    };
    const [total, items] = await this.prisma.$transaction([
      this.prisma.listing.count({ where }),
      this.prisma.listing.findMany({
        where, skip: (page - 1) * pageSize, take: pageSize,
        select: {
          id:true, slug:true, name:true, category:true, status:true,
          askingPriceMinor:true, annualRevenueMinor:true, recurringRevenuePct:true,
          createdAt:true, organization:{ select:{ name:true } },
        },
        orderBy:[{ createdAt:"desc" },{ id:"desc" }],
      }),
    ]);
    return serialize({ items, total, page, pageSize, pages:Math.ceil(total / pageSize) });
  }

  async mine(actor:User) {
    if (actor.role !== UserRole.SELLER && actor.role !== UserRole.ADMIN) throw new ForbiddenException("Seller account required");
    if (!actor.organizationId) return [];
    return serialize(await this.prisma.listing.findMany({
      where:{ organizationId:actor.organizationId },
      orderBy:{createdAt:"desc"},
      select:{id:true,slug:true,name:true,category:true,status:true,askingPriceMinor:true,annualRevenueMinor:true,createdAt:true},
      take:100,
    }));
  }

  async get(slug:string, actor?:User) {
    const listing = await this.prisma.listing.findUnique({
      where:{slug},include:{organization:{select:{id:true,name:true}}},
    });
    if (!listing) throw new NotFoundException("Business not found");
    if (listing.status !== ListingStatus.PUBLISHED && listing.organizationId !== actor?.organizationId && actor?.role !== UserRole.ADMIN) {
      throw new NotFoundException("Business not found");
    }
    return serialize(listing);
  }

  async create(actor:User,payload:unknown) {
    if (actor.role !== UserRole.SELLER) throw new ForbiddenException("Only sellers can list a business");
    const data = createListingSchema.parse(payload);
    const created = await this.prisma.$transaction(async tx => {
      let organizationId=actor.organizationId;
      if (!organizationId) {
        const org=await tx.organization.create({data:{name:`${actor.name}'s business`,country:"Nigeria"}});
        await tx.user.update({where:{id:actor.id},data:{organizationId:org.id}});
        organizationId=org.id;
      }
      const slug=`${data.name.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,70)}-${randomUUID().slice(0,8)}`;
      const listing=await tx.listing.create({data:{
        organizationId,slug,name:data.name,category:data.category,country:"Nigeria",
        askingPriceMinor:BigInt(data.askingPriceNaira)*100n,annualRevenueMinor:BigInt(data.annualRevenueNaira)*100n,
        recurringRevenuePct:data.recurringRevenuePct,customerConcentration:data.customerConcentration,
        revenueTrendPct:data.revenueTrendPct,ownerHoursPerWeek:data.ownerHoursPerWeek,
        ipAssigned:data.ipAssigned,litigationOpen:data.litigationOpen,currency:"NGN",
      }});
      await tx.auditEvent.create({data:{actorId:actor.id,resourceType:"LISTING",resourceId:listing.id,action:"LISTING_CREATED",metadata:{name:listing.name},correlationId:randomUUID()}});
      return listing;
    });
    return serialize(created);
  }

  async publish(slug:string,actor:User) {
    const listing=await this.prisma.listing.findUnique({where:{slug}});
    if (!listing) throw new NotFoundException("Listing not found");
    if (listing.organizationId!==actor.organizationId) throw new ForbiddenException("This is not your business");
    const kyc=await this.prisma.kycCase.findUnique({where:{userId:actor.id}});
    if (!kyc?.identityVerified || !kyc.businessVerified || !kyc.revenueVerified) {
      throw new ForbiddenException("Complete identity, business and revenue verification before publishing");
    }
    if (![ListingStatus.DRAFT,ListingStatus.ARCHIVED].includes(listing.status)) {
      throw new ConflictException("Only draft or archived listings can be published");
    }
    const updated=await this.prisma.$transaction(async tx=>{
      const changed=await tx.listing.update({where:{id:listing.id},data:{status:ListingStatus.PUBLISHED}});
      await tx.auditEvent.create({data:{actorId:actor.id,resourceType:"LISTING",resourceId:listing.id,action:"LISTING_PUBLISHED",metadata:{},correlationId:randomUUID()}});
      await tx.outboxEvent.create({data:{topic:"listing.published",aggregateId:listing.id,payload:{listingId:listing.id}}});
      return changed;
    });
    return serialize(updated);
  }

  async startDeal(slug:string,actor:User) {
    if (actor.role!==UserRole.BUYER) throw new ForbiddenException("Buyer account required");
    const kyc=await this.prisma.kycCase.findUnique({where:{userId:actor.id}});
    if (!kyc?.identityVerified) throw new ForbiddenException("Complete your identity verification before starting an acquisition");
    const listing=await this.prisma.listing.findUnique({
      where:{slug},include:{organization:{include:{users:{where:{role:UserRole.SELLER},orderBy:{createdAt:"asc"},take:1}}}},
    });
    if (!listing || listing.status!==ListingStatus.PUBLISHED) throw new NotFoundException("This listing is unavailable");
    const existing=await this.prisma.deal.findUnique({where:{listingId_buyerId:{listingId:listing.id,buyerId:actor.id}}});
    if (existing) return serialize(existing);
    const seller=listing.organization.users[0];
    if (!seller) throw new NotFoundException("Seller is unavailable");
    const advisor=await this.prisma.user.findFirst({where:{role:{in:[UserRole.ADVISOR,UserRole.ADMIN]}},orderBy:{createdAt:"asc"}});
    try {
      const deal=await this.prisma.$transaction(async tx=>{
        const created=await tx.deal.create({data:{
          ref:`DL-${new Date().getFullYear()}-${randomUUID().slice(0,8).toUpperCase()}`,
          listingId:listing.id,buyerId:actor.id,stage:"NDA_PENDING",
          participants:{create:[
            {userId:actor.id,role:UserRole.BUYER},{userId:seller.id,role:UserRole.SELLER},
            ...(advisor?[{userId:advisor.id,role:advisor.role}]:[]),
          ]},
          ndaAgreements:{create:{userId:actor.id,version:"1.0",status:"PENDING"}},
        }});
        await tx.auditEvent.create({data:{dealId:created.id,actorId:actor.id,resourceType:"DEAL",resourceId:created.id,action:"DEAL_CREATED",metadata:{summary:`Acquisition opened for ${listing.name}`},correlationId:randomUUID()}});
        await tx.outboxEvent.create({data:{topic:"deal.created",aggregateId:created.id,payload:{dealId:created.id,listingId:listing.id}}});
        return created;
      });
      return serialize(deal);
    } catch(error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code==="P2002") {
        const current=await this.prisma.deal.findUnique({where:{listingId_buyerId:{listingId:listing.id,buyerId:actor.id}}});
        if (current) return serialize(current);
      }
      throw error;
    }
  }
}
