import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { NdaStatus, User, UserRole } from "@prisma/client";
import { dataRoomUploadSchema } from "@dealos/contracts";
import { randomUUID } from "node:crypto";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import { serialize } from "../common/serialize";

const storageDir=resolve(process.env.DEALOS_PRIVATE_DOCUMENT_DIR || "../../.private/data-room");
function valid(bytes:Buffer,mime:string) {
  if(mime==="application/pdf") return bytes.subarray(0,5).toString("ascii")==="%PDF-";
  if(mime==="image/jpeg") return bytes[0]===255 && bytes[1]===216 && bytes[2]===255;
  if(mime==="image/png") return bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]));
  if(mime==="text/csv") return !bytes.includes(0) && bytes.length<4_000_000;
  return false;
}
@Injectable()
export class DataRoomService {
 constructor(private readonly prisma:PrismaService,private readonly audit:AuditService){}

 private async accessContext(dealId:string,actor:User) {
  const deal=await this.prisma.deal.findUnique({where:{id:dealId},include:{participants:true,ndaAgreements:true}});
  if(!deal) throw new NotFoundException("Deal not found");
  if(deal.stage==="WITHDRAWN") throw new ForbiddenException("Access to withdrawn acquisitions has ended");
  const participant=deal.participants.some(p=>p.userId===actor.id);
  if(!(actor.role === UserRole.ADMIN || actor.role === UserRole.ADVISOR) && !participant) throw new ForbiddenException("Not a participant in this acquisition");
  const signed=deal.ndaAgreements.some(n=>n.userId===actor.id && n.status===NdaStatus.SIGNED);
  const privileged=(actor.role === UserRole.ADMIN || actor.role === UserRole.ADVISOR || actor.role === UserRole.SELLER);
  return {deal,allowed:privileged||signed};
 }

 async list(dealId:string,actor:User){
  const {deal,allowed}=await this.accessContext(dealId,actor);
  if(!allowed) throw new ForbiddenException("Sign the NDA to view confidential documents");
  return serialize(await this.prisma.dataRoomDocument.findMany({
   where:{listingId:deal.listingId,active:true},
   select:{id:true,name:true,category:true,contentType:true,sizeBytes:true,createdAt:true},
   orderBy:[{category:"asc"},{name:"asc"}],take:200,
  }));
 }

 async owned(listingId:string,actor:User){
  const listing=await this.prisma.listing.findUnique({where:{id:listingId}});
  if(!listing || listing.organizationId!==actor.organizationId || actor.role!==UserRole.SELLER) throw new ForbiddenException("Seller listing access required");
  return serialize(await this.prisma.dataRoomDocument.findMany({
   where:{listingId,active:true},select:{id:true,name:true,category:true,sizeBytes:true,contentType:true,createdAt:true},
   orderBy:{createdAt:"desc"},take:200,
  }));
 }

 async upload(actor:User,payload:unknown){
  if(actor.role!==UserRole.SELLER) throw new ForbiddenException("Seller account required");
  if(process.env.DEALOS_DEMO_DOCUMENTS_ENABLED!=="true") throw new ForbiddenException("Sandbox document uploads are disabled");
  const input=dataRoomUploadSchema.parse(payload);
  const listing=await this.prisma.listing.findUnique({where:{id:input.listingId}});
  if(!listing || listing.organizationId!==actor.organizationId) throw new ForbiddenException("You do not own this listing");
  const bytes=Buffer.from(input.dataBase64,"base64");
  if(bytes.length<12 || bytes.length>4_000_000 || !valid(bytes,input.contentType)) {
    throw new BadRequestException("Use a synthetic PDF, image or CSV file under 4MB");
  }
  const storageKey=`${listing.id}/${randomUUID()}`;
  const filePath=join(storageDir,...storageKey.split("/"));
  await mkdir(join(storageDir,listing.id),{recursive:true,mode:0o700});
  await writeFile(filePath,bytes,{mode:0o600,flag:"wx"});
  try{
   const doc=await this.prisma.$transaction(async tx=>{
    const created=await tx.dataRoomDocument.create({data:{
     listingId:listing.id,name:input.name,category:input.category,objectKey:storageKey,
     contentType:input.contentType,sizeBytes:bytes.length,
    }});
    await tx.auditEvent.create({data:{
     actorId:actor.id,resourceType:"DATA_ROOM_DOCUMENT",resourceId:created.id,
     action:"DOCUMENT_UPLOADED",metadata:{listingId:listing.id,name:created.name},correlationId:randomUUID(),
    }});
    return created;
   });
   return serialize({id:doc.id,name:doc.name,category:doc.category,sizeBytes:doc.sizeBytes});
  }catch(e){await rm(filePath,{force:true});throw e;}
 }

 private async authorizedDocument(id:string,dealId:string,actor:User){
  const document=await this.prisma.dataRoomDocument.findUnique({where:{id}});
  if(!document || !document.active) throw new NotFoundException("Document not found");
  const {deal,allowed}=await this.accessContext(dealId,actor);
  if(!allowed || deal.listingId!==document.listingId) throw new ForbiddenException("NDA or deal access required");
  return document;
 }

 async access(documentId:string,dealId:string,actor:User){
  const document=await this.authorizedDocument(documentId,dealId,actor);
  const correlationId=randomUUID();
  await this.prisma.$transaction(async tx=>{
   await tx.dataRoomAccess.create({data:{documentId,userId:actor.id,dealId,allowed:true}});
   await this.audit.create({dealId,actor,resourceType:"DATA_ROOM_DOCUMENT",resourceId:documentId,
     action:"DOCUMENT_OPENED",metadata:{name:document.name},correlationId},tx);
  });
  return {document:{id:document.id,name:document.name},
   signedUrl:`/api/data-room/documents/${document.id}/download?dealId=${encodeURIComponent(dealId)}`,
   expiresInSeconds:null};
 }

 async download(documentId:string,dealId:string,actor:User){
  const document=await this.authorizedDocument(documentId,dealId,actor);
  const [owner,id]=document.objectKey.split("/");
  if(owner!==document.listingId || !/^[0-9a-f-]{36}$/.test(id||"")) {
   throw new NotFoundException("Only uploaded sample files can be downloaded");
  }
  let bytes:Buffer;
  try{bytes=await readFile(join(storageDir,owner,id));}catch{throw new NotFoundException("Document contents unavailable");}
  await this.prisma.dataRoomAccess.create({data:{documentId,userId:actor.id,dealId,allowed:true}});
  return {bytes,mime:document.contentType,name:document.name};
 }
}
