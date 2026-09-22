import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { DealStage, ListingStatus, OfferStatus, Prisma, User, UserRole } from "@prisma/client";
import { randomUUID } from "node:crypto";
import { submitOfferSchema } from "@dealos/contracts";
import { PrismaService } from "../prisma/prisma.service";
import { serialize } from "../common/serialize";

@Injectable()
export class OffersService {
  constructor(private readonly prisma:PrismaService){}

  async submit(dealId:string,actor:User,payload:unknown) {
    if(actor.role!==UserRole.BUYER) throw new ForbiddenException("Buyer account required");
    const input=submitOfferSchema.parse(payload);
    const deal=await this.prisma.deal.findUnique({where:{id:dealId},include:{ndaAgreements:true,listing:true}});
    if(!deal || deal.buyerId!==actor.id) throw new NotFoundException("Acquisition not found");
    if(deal.stage!==DealStage.DILIGENCE) throw new ConflictException("Sign the NDA before making an offer");
    if(deal.listing.status!==ListingStatus.PUBLISHED) throw new ConflictException("This business is no longer accepting offers");
    if(!deal.ndaAgreements.some(x=>x.userId===actor.id && x.status==="SIGNED")) throw new ForbiddenException("Signed NDA required");
    const kyc=await this.prisma.kycCase.findUnique({where:{userId:actor.id}});
    if(!kyc?.identityVerified) throw new ForbiddenException("Identity verification required");
    try {
      const offer=await this.prisma.$transaction(async tx=>{
        const created=await tx.acquisitionOffer.create({data:{
          dealId,buyerId:actor.id,amountMinor:BigInt(input.amountNaira)*100n,message:input.message||null,
        }});
        await tx.auditEvent.create({data:{dealId,actorId:actor.id,resourceType:"OFFER",resourceId:created.id,action:"OFFER_SUBMITTED",metadata:{amountMinor:created.amountMinor.toString()},correlationId:randomUUID()}});
        await tx.outboxEvent.create({data:{topic:"offer.submitted",aggregateId:dealId,payload:{dealId,offerId:created.id}}});
        return created;
      });
      return serialize(offer);
    } catch(e) {
      if(e instanceof Prisma.PrismaClientKnownRequestError && e.code==="P2002") throw new ConflictException("An offer already exists for this deal");
      throw e;
    }
  }

  async respond(dealId:string,actor:User,accept:boolean) {
    if(actor.role!==UserRole.SELLER) throw new ForbiddenException("Seller account required");
    return serialize(await this.prisma.$transaction(async tx=>{
      const deal=await tx.deal.findUnique({where:{id:dealId},include:{listing:true,offer:true}});
      if(!deal || deal.listing.organizationId!==actor.organizationId) throw new NotFoundException("Offer not found");
      if(!deal.offer || deal.offer.status!==OfferStatus.SUBMITTED) throw new ConflictException("This offer cannot be reviewed");
      if(accept) {
        const sellerKyc=await tx.kycCase.findUnique({where:{userId:actor.id}});
        if(!sellerKyc?.identityVerified || !sellerKyc.businessVerified || !sellerKyc.revenueVerified) throw new ForbiddenException("Complete seller verification to accept offers");
        const locked=await tx.listing.updateMany({where:{id:deal.listingId,status:ListingStatus.PUBLISHED},data:{status:ListingStatus.UNDER_OFFER}});
        if(locked.count!==1) throw new ConflictException("Another offer was accepted or the listing is unavailable");
        await tx.deal.update({where:{id:deal.id},data:{agreedPriceMinor:deal.offer.amountMinor,stage:DealStage.LOI,version:{increment:1}}});
        await tx.escrowAccount.create({data:{dealId,amountMinor:deal.offer.amountMinor,currency:"NGN",status:"CREATED"}});
        await tx.assetTransferItem.createMany({data:[
          "Primary business domain and DNS",
          "Source code and deployment access",
          "Product and cloud infrastructure",
          "Customer contracts and operating records",
          "Intellectual property and brand assets",
        ].map(label=>({dealId,label}))});
        await tx.deal.updateMany({where:{listingId:deal.listingId,id:{not:dealId},stage:{notIn:[DealStage.COMPLETED,DealStage.WITHDRAWN]}},data:{stage:DealStage.WITHDRAWN,version:{increment:1}}});
        await tx.acquisitionOffer.updateMany({where:{deal:{listingId:deal.listingId},id:{not:deal.offer.id},status:OfferStatus.SUBMITTED},data:{status:OfferStatus.DECLINED,reviewedAt:new Date()}});
      } else {
        await tx.deal.update({where:{id:deal.id},data:{stage:DealStage.WITHDRAWN,version:{increment:1}}});
      }
      const updated=await tx.acquisitionOffer.update({where:{id:deal.offer.id},data:{status:accept?OfferStatus.ACCEPTED:OfferStatus.DECLINED,reviewedAt:new Date()}});
      await tx.auditEvent.create({data:{dealId,actorId:actor.id,resourceType:"OFFER",resourceId:updated.id,action:accept?"OFFER_ACCEPTED":"OFFER_DECLINED",metadata:{amountMinor:updated.amountMinor.toString()},correlationId:randomUUID()}});
      await tx.outboxEvent.create({data:{topic:accept?"offer.accepted":"offer.declined",aggregateId:dealId,payload:{dealId,offerId:updated.id}}});
      return updated;
    }));
  }
}
