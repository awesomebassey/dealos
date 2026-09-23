import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { EvidenceCategory, EvidenceStatus, KycStatus, User, UserRole } from "@prisma/client";
import { evidenceUploadSchema, verificationReviewSchema } from "@dealos/contracts";
import { randomUUID } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { serialize } from "../common/serialize";

const documentTypes:Record<"BUSINESS"|"REVENUE",string[]>={
  BUSINESS:["CAC_CERTIFICATE","OWNERSHIP_PROOF","ADDRESS_EVIDENCE"],
  REVENUE:["BANK_STATEMENT","PROFIT_LOSS"],
};
type Section="BUSINESS"|"REVENUE";
function isReviewer(user:User){return user.role===UserRole.ADVISOR||user.role===UserRole.ADMIN;}
function fileMatches(bytes:Buffer,mime:string){
  if(mime==="application/pdf")return bytes.subarray(0,5).toString("ascii")==="%PDF-";
  if(mime==="image/png")return bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if(mime==="image/jpeg")return bytes[0]===255&&bytes[1]===216&&bytes[2]===255;
  return false;
}
const evidenceFields={
  id:true,category:true,documentType:true,fileName:true,contentType:true,fileSize:true,
  status:true,reviewNote:true,createdAt:true,
} as const;

@Injectable()
export class ListingVerificationService {
  constructor(private readonly prisma:PrismaService){}

  private async listing(slug:string,actor:User,ownerOnly=false){
    const listing=await this.prisma.listing.findUnique({
      where:{slug},select:{id:true,name:true,slug:true,organizationId:true,status:true},
    });
    if(!listing)throw new NotFoundException("Business not found");
    const owner=actor.role===UserRole.SELLER&&actor.organizationId===listing.organizationId;
    if(!owner&&(!isReviewer(actor)||ownerOnly))throw new ForbiddenException("Business verification access required");
    return listing;
  }

  async get(slug:string,actor:User){
    const listing=await this.listing(slug,actor);
    const verification=await this.prisma.listingVerification.findUnique({
      where:{listingId:listing.id},
      include:{evidence:{select:evidenceFields,orderBy:{createdAt:"desc"}}},
    });
    if(!verification)throw new NotFoundException("Business verification not initialized");
    return serialize({listing,verification});
  }

  async queue(actor:User){
    if(!isReviewer(actor))throw new ForbiddenException("Reviewer access required");
    return serialize(await this.prisma.listingVerification.findMany({
      where:{evidence:{some:{status:EvidenceStatus.SUBMITTED}}},
      include:{
        listing:{select:{id:true,slug:true,name:true,organization:{select:{name:true}}}},
        evidence:{select:{category:true,status:true}},
      },
      orderBy:{updatedAt:"asc"},take:100,
    }));
  }

  async submit(slug:string,actor:User,body:unknown){
    if(process.env.DEALOS_DEMO_VERIFICATION_ENABLED==="false")throw new ForbiddenException("Sample submissions are unavailable");
    const listing=await this.listing(slug,actor,true);
    const input=evidenceUploadSchema.parse(body);
    if(input.category!==EvidenceCategory.BUSINESS&&input.category!==EvidenceCategory.REVENUE){
      throw new BadRequestException("Identity verification belongs to the account");
    }
    if(!documentTypes[input.category].includes(input.documentType))throw new BadRequestException("Choose a matching document type");
    const bytes=Buffer.from(input.dataBase64,"base64");
    if(bytes.length<12||bytes.length>2_000_000||!fileMatches(bytes,input.contentType)){
      throw new BadRequestException("Choose a PDF, PNG or JPEG sample under 2MB");
    }
    const result=await this.prisma.$transaction(async tx=>{
      const verification=await tx.listingVerification.findUniqueOrThrow({where:{listingId:listing.id}});
      const evidence=await tx.listingEvidence.create({data:{
        verificationId:verification.id,category:input.category,documentType:input.documentType,
        fileName:input.fileName.replace(/[^a-zA-Z0-9._ -]/g,"_").slice(0,120),
        contentType:input.contentType,fileSize:bytes.length,contentBytes:bytes,
      }});
      await tx.listingVerification.update({where:{id:verification.id},data:{
        status:KycStatus.IN_REVIEW,
        ...(input.category===EvidenceCategory.BUSINESS?{businessVerified:false}:{revenueVerified:false}),
      }});
      await tx.auditEvent.create({data:{
        actorId:actor.id,resourceType:"LISTING_EVIDENCE",resourceId:evidence.id,
        action:"LISTING_SAMPLE_SUBMITTED",metadata:{listingId:listing.id,category:input.category},correlationId:randomUUID(),
      }});
      return evidence;
    });
    return serialize({id:result.id,category:result.category,fileName:result.fileName,status:result.status});
  }

  async sample(slug:string,id:string,actor:User){
    const listing=await this.listing(slug,actor);
    const evidence=await this.prisma.listingEvidence.findFirst({
      where:{id,verification:{listingId:listing.id}},
    });
    if(!evidence||!evidence.contentBytes)throw new NotFoundException("Sample unavailable");
    await this.prisma.auditEvent.create({data:{
      actorId:actor.id,resourceType:"LISTING_EVIDENCE",resourceId:evidence.id,
      action:"LISTING_SAMPLE_VIEWED",metadata:{listingId:listing.id,category:evidence.category},correlationId:randomUUID(),
    }});
    return {bytes:Buffer.from(evidence.contentBytes),contentType:evidence.contentType};
  }

  async review(slug:string,actor:User,body:unknown){
    if(!isReviewer(actor))throw new ForbiddenException("Reviewer access required");
    const input=verificationReviewSchema.parse(body);
    if(input.category!==EvidenceCategory.BUSINESS&&input.category!==EvidenceCategory.REVENUE){
      throw new BadRequestException("Review account identity separately");
    }
    const listing=await this.listing(slug,actor);
    const category:Section=input.category;
    return serialize(await this.prisma.$transaction(async tx=>{
      const row=await tx.listingVerification.findUniqueOrThrow({
        where:{listingId:listing.id},include:{evidence:true},
      });
      await tx.$queryRaw`SELECT "id" FROM "ListingVerification" WHERE "id"=${row.id} FOR UPDATE`;
      const pending=row.evidence.filter(e=>e.category===category&&e.status===EvidenceStatus.SUBMITTED);
      if(!pending.length)throw new BadRequestException("No samples awaiting review in this section");
      if(input.approve){
        const viewed=await tx.auditEvent.findMany({where:{
          actorId:actor.id,resourceType:"LISTING_EVIDENCE",action:"LISTING_SAMPLE_VIEWED",
          resourceId:{in:pending.map(e=>e.id)},
        },distinct:["resourceId"],select:{resourceId:true}});
        if(viewed.length!==pending.length)throw new BadRequestException("Open each pending sample before approval");
        const approved=new Set(row.evidence.filter(e=>e.category===category&&e.status===EvidenceStatus.APPROVED).map(e=>e.documentType));
        for(const e of pending)approved.add(e.documentType);
        if(!documentTypes[category].every(type=>approved.has(type))){
          throw new BadRequestException("Submit all required documents for this business");
        }
      }
      await tx.listingEvidence.updateMany({where:{id:{in:pending.map(e=>e.id)}},data:{
        status:input.approve?EvidenceStatus.APPROVED:EvidenceStatus.REJECTED,
        reviewedById:actor.id,reviewedAt:new Date(),reviewNote:input.note||null,
      }});
      const businessVerified=category==="BUSINESS"?input.approve:row.businessVerified;
      const revenueVerified=category==="REVENUE"?input.approve:row.revenueVerified;
      const updated=await tx.listingVerification.update({where:{id:row.id},data:{
        businessVerified,revenueVerified,
        status:input.approve?(businessVerified&&revenueVerified?KycStatus.VERIFIED:KycStatus.IN_REVIEW):KycStatus.NEEDS_INFORMATION,
        reviewedAt:new Date(),
      }});
      await tx.auditEvent.create({data:{
        actorId:actor.id,resourceType:"LISTING_VERIFICATION",resourceId:row.id,
        action:input.approve?"LISTING_SECTION_APPROVED":"LISTING_SECTION_RETURNED",
        metadata:{listingId:listing.id,category,note:input.note||null},correlationId:randomUUID(),
      }});
      await tx.outboxEvent.create({data:{
        topic:"listing.verification_reviewed",aggregateId:listing.id,
        payload:{listingId:listing.id,category,approved:input.approve},
      }});
      return updated;
    }));
  }
}
