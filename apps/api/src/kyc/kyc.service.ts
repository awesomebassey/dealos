import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { EvidenceCategory, EvidenceStatus, KycStatus, User, UserRole } from "@prisma/client";
import { evidenceUploadSchema, verificationReviewSchema } from "@dealos/contracts";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { PrismaService } from "../prisma/prisma.service";
import { serialize } from "../common/serialize";

const kinds:Record<EvidenceCategory,string[]>={
  IDENTITY:["NIN_SLIP","BVN_CONFIRMATION","DRIVERS_LICENSE","VOTERS_CARD"],
  BUSINESS:["CAC_CERTIFICATE","OWNERSHIP_PROOF","ADDRESS_EVIDENCE"],
  REVENUE:["BANK_STATEMENT","PROFIT_LOSS"],
};
const storageDir=resolve(process.env.DEALOS_PRIVATE_UPLOAD_DIR || resolve(process.cwd(),"../../.private/verification"));
function looksLike(bytes:Buffer,mime:string) {
  return (mime==="application/pdf" && bytes.subarray(0,5).toString("ascii")==="%PDF-") ||
    (mime==="image/jpeg" && bytes[0]===0xff && bytes[1]===0xd8 && bytes[2]===0xff) ||
    (mime==="image/png" && bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])));
}

@Injectable()
export class KycService {
  constructor(private readonly prisma:PrismaService){}

  async me(actor:User) {
    const item=await this.prisma.kycCase.findUnique({where:{userId:actor.id},include:{
      evidence:{select:{id:true,category:true,documentType:true,fileName:true,fileSize:true,status:true,reviewNote:true,createdAt:true},orderBy:{createdAt:"desc"}},
    }});
    if(!item) throw new NotFoundException("No verification case found");
    return serialize(item);
  }

  async get(userId:string,actor:User) {
    if(!(actor.role === UserRole.ADVISOR || actor.role === UserRole.ADMIN)) throw new ForbiddenException("Reviewer account required");
    const item=await this.prisma.kycCase.findUnique({where:{userId},include:{
      user:{select:{id:true,name:true,email:true,role:true}},
      evidence:{select:{id:true,category:true,documentType:true,fileName:true,fileSize:true,status:true,reviewNote:true,createdAt:true},orderBy:{createdAt:"desc"}},
    }});
    if(!item) throw new NotFoundException("Verification case not found");
    return serialize(item);
  }

  async queue(actor:User) {
    if(!(actor.role === UserRole.ADVISOR || actor.role === UserRole.ADMIN)) throw new ForbiddenException("Reviewer account required");
    return serialize(await this.prisma.kycCase.findMany({
      where:{evidence:{some:{status:EvidenceStatus.SUBMITTED,category:EvidenceCategory.IDENTITY}}},
      include:{user:{select:{id:true,name:true,email:true,role:true}},evidence:{select:{category:true,status:true,documentType:true}}},
      orderBy:{updatedAt:"asc"},take:100,
    }));
  }

  async submit(actor:User,body:unknown) {
    if(actor.role!==UserRole.BUYER && actor.role!==UserRole.SELLER) throw new ForbiddenException("Verification applies to buyers and sellers");
    if(process.env.DEALOS_DEMO_VERIFICATION_ENABLED !== "true") throw new ForbiddenException("Sample uploads are unavailable");
    const input=evidenceUploadSchema.parse(body);
    if(input.category!==EvidenceCategory.IDENTITY) throw new BadRequestException("Business and revenue evidence must be submitted under a specific business");
    if(!kinds[input.category].includes(input.documentType)) throw new BadRequestException("Document type does not match evidence category");
    const bytes=Buffer.from(input.dataBase64,"base64");
    if(bytes.length<12 || bytes.length>4_000_000 || !looksLike(bytes,input.contentType)) {
      throw new BadRequestException("Invalid document. Use a synthetic PDF, PNG or JPEG under 4MB.");
    }
    const fileName=input.fileName.replace(/[^a-zA-Z0-9._ -]/g,"_").slice(0,120);
    const key=`${actor.id}/${randomUUID()}`;
    const result=await this.prisma.$transaction(async tx=>{
        if(actor.role===UserRole.SELLER && actor.organizationId){
          // The seller's replacement identity evidence invalidates their
          // account approval, so public listings are paused during re-review.
          await tx.listing.updateMany({
            where:{organizationId:actor.organizationId,status:"PUBLISHED"},
            data:{status:"ARCHIVED"},
          });
        }
        const item=await tx.kycCase.upsert({where:{userId:actor.id},
          create:{userId:actor.id,country:"Nigeria",status:KycStatus.IN_REVIEW},
          update:{
            status:KycStatus.IN_REVIEW,
            ...(input.category==="IDENTITY"?{identityVerified:false}:{}),
            ...(input.category==="BUSINESS"?{businessVerified:false}:{}),
            ...(input.category==="REVENUE"?{revenueVerified:false}:{}),
          },
        });
        const evidence=await tx.verificationEvidence.create({data:{
          caseId:item.id,category:input.category,documentType:input.documentType,
          fileName,contentType:input.contentType,fileSize:bytes.length,storageKey:key,contentBytes:bytes,
        }});
        await tx.auditEvent.create({data:{actorId:actor.id,resourceType:"KYC_EVIDENCE",resourceId:evidence.id,action:"DEMO_EVIDENCE_SUBMITTED",metadata:{category:input.category,documentType:input.documentType},correlationId:randomUUID()}});
        await tx.outboxEvent.create({data:{
          topic:"kyc.evidence_submitted",aggregateId:item.id,
          payload:{userId:actor.id,evidenceId:evidence.id,category:input.category},
        }});
        return evidence;
      });
    return serialize({id:result.id,category:result.category,status:result.status,fileName:result.fileName});
  }

  async sample(evidenceId:string,actor:User) {
    if(process.env.DEALOS_DEMO_VERIFICATION_ENABLED !== "true"){
      throw new ForbiddenException("Synthetic evidence previews are disabled");
    }
    const evidence=await this.prisma.verificationEvidence.findUnique({
      where:{id:evidenceId},include:{kycCase:{select:{userId:true}}},
    });
    if(!evidence) throw new NotFoundException("Sample not found");
    const reviewer=actor.role===UserRole.ADVISOR || actor.role===UserRole.ADMIN;
    if(!reviewer && actor.id!==evidence.kycCase.userId){
      throw new ForbiddenException("You cannot access this sample");
    }
    const [owner,fileId]=evidence.storageKey.split("/");
    if(owner!==evidence.kycCase.userId || !/^[0-9a-f-]{36}$/.test(fileId||"")){
      throw new NotFoundException("Sample not found");
    }
    let bytes:Buffer;
    if(evidence.contentBytes){
      bytes=Buffer.from(evidence.contentBytes);
    }else{
      try {bytes=await readFile(join(storageDir,owner,fileId));}
      catch {throw new NotFoundException("Sample file is unavailable");}
    }
    await this.prisma.auditEvent.create({data:{
      actorId:actor.id,resourceType:"KYC_EVIDENCE",resourceId:evidenceId,
      action:"DEMO_EVIDENCE_VIEWED",
      metadata:{category:evidence.category,documentType:evidence.documentType},
      correlationId:randomUUID(),
    }});
    return {bytes,contentType:evidence.contentType};
  }

  async review(userId:string,actor:User,payload:unknown) {
    if(!(actor.role === UserRole.ADVISOR || actor.role === UserRole.ADMIN)) throw new ForbiddenException("Reviewer account required");
    const input=verificationReviewSchema.parse(payload);
    if(input.category!==EvidenceCategory.IDENTITY) throw new BadRequestException("Review business evidence under its own listing");
    return this.prisma.$transaction(async tx=>{
      const item=await tx.kycCase.findUnique({where:{userId},include:{user:true,evidence:true}});
      if(!item) throw new NotFoundException("Verification case not found");
      const documents=item.evidence.filter(e=>e.category===input.category && e.status===EvidenceStatus.SUBMITTED);
      if(!documents.length) throw new BadRequestException("No submitted evidence to review");
      const all=[...item.evidence.filter(e=>e.category===input.category && e.status===EvidenceStatus.APPROVED),...documents];
      if(input.approve) {
        const inspected=await tx.auditEvent.findMany({
          where:{
            actorId:actor.id,resourceType:"KYC_EVIDENCE",action:"DEMO_EVIDENCE_VIEWED",
            resourceId:{in:documents.map(e=>e.id)},
          },
          distinct:["resourceId"],
          select:{resourceId:true},
        });
        if(inspected.length!==documents.length) {
          throw new BadRequestException("Open each submitted sample before approving the demonstration review");
        }
        const types=new Set(all.map(e=>e.documentType));
        const ok=input.category==="IDENTITY" ? all.length>=1 :
          input.category==="BUSINESS" ? ["CAC_CERTIFICATE","OWNERSHIP_PROOF","ADDRESS_EVIDENCE"].every(t=>types.has(t)) :
          ["BANK_STATEMENT","PROFIT_LOSS"].every(t=>types.has(t));
        if(!ok) throw new BadRequestException("Upload the complete evidence set for this category");
      }
      await tx.verificationEvidence.updateMany({where:{id:{in:documents.map(e=>e.id)}},data:{
        status:input.approve?EvidenceStatus.APPROVED:EvidenceStatus.REJECTED,
        reviewedAt:new Date(),reviewedById:actor.id,reviewNote:input.note||null,
      }});
      const flags={
        identityVerified:input.category==="IDENTITY"?input.approve:item.identityVerified,
        businessVerified:input.category==="BUSINESS"?input.approve:item.businessVerified,
        revenueVerified:input.category==="REVENUE"?input.approve:item.revenueVerified,
      };
      const done=flags.identityVerified;
      const updated=await tx.kycCase.update({where:{id:item.id},data:{
        ...flags,status:!input.approve?KycStatus.NEEDS_INFORMATION:done?KycStatus.VERIFIED:KycStatus.IN_REVIEW,
        reviewedAt:new Date(),
      }});
      await tx.auditEvent.create({data:{
        actorId:actor.id,resourceType:"KYC",resourceId:item.id,
        action:input.approve?"DEMO_VERIFICATION_APPROVED":"DEMO_VERIFICATION_REJECTED",
        metadata:{category:input.category,userId,reviewNote:input.note||null},correlationId:randomUUID(),
      }});
      await tx.outboxEvent.create({data:{
        topic:"kyc.reviewed",aggregateId:item.id,
        payload:{userId,category:input.category,approved:input.approve},
      }});
      return serialize(updated);
    });
  }
}
