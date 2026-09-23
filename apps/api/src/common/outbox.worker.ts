import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { OutboxStatus, Prisma, UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

type Tx = Prisma.TransactionClient;
type Event = { id:string; topic:string; aggregateId:string; payload:Prisma.JsonValue; attempts:number };
type Message = {recipientId:string;sourceEventId:string;title:string;description:string;href:string};
class UnsupportedEvent extends Error {}

const dealTitles:Record<string,string>={
  "deal.created":"A new acquisition has started",
  "deal.nda_signed":"Acquisition NDA signed",
  "deal.stage_changed":"Acquisition stage updated",
  "offer.submitted":"A buyer submitted an offer",
  "offer.accepted":"Your acquisition offer was accepted",
  "offer.declined":"Your acquisition offer was declined",
  "escrow.created":"Simulated escrow is ready",
  "escrow.funded":"Demo escrow has been funded",
  "escrow.released":"Simulated settlement is complete",
  "diligence.question_answered":"A diligence question was answered",
  "diligence.completed":"Due diligence review updated",
};

@Injectable()
export class OutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger=new Logger(OutboxWorker.name);
  private timer?:NodeJS.Timeout;
  private running=false;
  constructor(private readonly prisma:PrismaService){}

  onModuleInit(){
    void this.drain();
    this.timer=setInterval(()=>void this.drain(),3_000);
    this.timer.unref();
  }
  onModuleDestroy(){if(this.timer)clearInterval(this.timer);}

  private async resolve(tx:Tx,event:Event):Promise<Message[]>{
    if(event.topic in dealTitles){
      const deal=await tx.deal.findUnique({
        where:{id:event.aggregateId},
        select:{id:true,listing:{select:{name:true}},participants:{select:{userId:true}}},
      });
      if(!deal)return [];
      return deal.participants.map(p=>({
        recipientId:p.userId,sourceEventId:event.id,
        title:dealTitles[event.topic],description:deal.listing.name,
        href:`/deals/${deal.id}`,
      }));
    }
    if(event.topic==="listing.published"){
      const listing=await tx.listing.findUnique({
        where:{id:event.aggregateId},
        select:{name:true,slug:true,organization:{select:{users:{select:{id:true,role:true}}}}},
      });
      if(!listing)return [];
      return listing.organization.users.filter(u=>u.role===UserRole.SELLER).map(u=>({
        recipientId:u.id,sourceEventId:event.id,title:"Your business is published",
        description:listing.name,href:`/my-listings/${listing.slug}`,
      }));
    }

    if(event.topic==="listing.verification_reviewed"){
      const listing=await tx.listing.findUnique({
        where:{id:event.aggregateId},
        select:{
          name:true,slug:true,
          organization:{select:{users:{where:{role:UserRole.SELLER},select:{id:true}}}},
        },
      });
      if(!listing)return [];
      const payload=event.payload&&typeof event.payload==="object"&&!Array.isArray(event.payload)
        ?event.payload as Record<string,unknown>:{};
      const category=typeof payload.category==="string"?payload.category.toLowerCase():"business";
      const approved=payload.approved===true;
      return listing.organization.users.map(user=>({
        recipientId:user.id,sourceEventId:event.id,
        title:approved?"Your business samples were approved":"Business samples need attention",
        description:`${listing.name}: ${category} review`,
        href:`/my-listings/${listing.slug}/verification`,
      }));
    }
    if(event.topic==="kyc.evidence_submitted" || event.topic==="listing.verification_submitted"){
      const reviewers=await tx.user.findMany({
        where:{role:{in:[UserRole.ADVISOR,UserRole.ADMIN]}},
        select:{id:true},
      });
      if(!reviewers.length)return [];
      if(event.topic==="kyc.evidence_submitted"){
        const payload=event.payload&&typeof event.payload==="object"&&!Array.isArray(event.payload)
          ?event.payload as Record<string,unknown>:{};
        const userId=typeof payload.userId==="string"?payload.userId:"";
        if(!userId)return [];
        return reviewers.map(user=>({
          recipientId:user.id,sourceEventId:event.id,title:"Personal sample awaiting review",
          description:"A buyer or seller submitted identity evidence",
          href:`/reviews/${userId}`,
        }));
      }
      const listing=await tx.listing.findUnique({
        where:{id:event.aggregateId},select:{name:true,slug:true},
      });
      if(!listing)return [];
      return reviewers.map(user=>({
        recipientId:user.id,sourceEventId:event.id,
        title:"Business sample awaiting review",description:listing.name,
        href:`/reviews/businesses/${listing.slug}`,
      }));
    }
    if(event.topic==="kyc.reviewed"){
      const payload=event.payload&&typeof event.payload==="object"&&!Array.isArray(event.payload)
        ?event.payload as Record<string,unknown>: {};
      const userId=typeof payload.userId==="string"?payload.userId:"";
      if(!userId)return [];
      const user=await tx.user.findUnique({where:{id:userId},select:{id:true}});
      if(!user)return [];
      const category=typeof payload.category==="string"?payload.category.toLowerCase():"identity";
      const approved=payload.approved===true;
      return [{
        recipientId:user.id,sourceEventId:event.id,
        title:approved?"Your demo verification was approved":"More verification information is needed",
        description:category.charAt(0).toUpperCase()+category.slice(1)+" sample review",
        href:`/kyc/${["identity","business","revenue"].includes(category)?category:"identity"}`,
      }];
    }
    throw new UnsupportedEvent(
      event.topic==="auth.password_reset_requested"
        ?"Legacy password reset event has no deliverable token. Request a new reset."
        :`No notification handler for event topic ${event.topic}`
    );
  }

  async drain(){
    if(this.running)return;
    this.running=true;
    try{
      const claimed=await this.prisma.$transaction(async tx=>{
        const rows=await tx.$queryRaw<Array<{id:string}>>`
          SELECT id FROM "OutboxEvent"
          WHERE (
            (status='PENDING' AND "availableAt"<=NOW()) OR
            (status='PROCESSING' AND "availableAt"<=NOW())
          )
          AND attempts < 8
          ORDER BY "createdAt" ASC
          FOR UPDATE SKIP LOCKED LIMIT 10
        `;
        if(!rows.length)return [];
        const ids=rows.map(r=>r.id);
        await tx.outboxEvent.updateMany({
          where:{id:{in:ids}},
          data:{status:OutboxStatus.PROCESSING,attempts:{increment:1},
            availableAt:new Date(Date.now()+120_000)},
        });
        return tx.outboxEvent.findMany({where:{id:{in:ids}}});
      });

      for(const event of claimed){
        try{
          await this.prisma.$transaction(async tx=>{
            const notifications=await this.resolve(tx,event);
            if(notifications.length)await tx.notification.createMany({data:notifications,skipDuplicates:true});
            await tx.outboxEvent.update({
              where:{id:event.id},data:{status:OutboxStatus.DELIVERED,deliveredAt:new Date(),lastError:null},
            });
          });
        }catch(error){
          const terminal=error instanceof UnsupportedEvent || event.attempts>=8;
          await this.prisma.outboxEvent.update({
            where:{id:event.id},
            data:{status:terminal?OutboxStatus.FAILED:OutboxStatus.PENDING,
              availableAt:new Date(Date.now()+Math.min(3600,10*2**event.attempts)*1000),
              lastError:error instanceof Error?error.message:"Notification processing failed"},
          });
          this.logger.warn(`Outbox event ${event.id}: ${error instanceof Error?error.message:"Failed"}`);
        }
      }
    }catch(error){
      this.logger.error(error instanceof Error?error.message:String(error));
    }finally{this.running=false;}
  }
}
