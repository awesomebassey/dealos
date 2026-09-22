import { Body, Controller, Get, Param, Post, Res, UseGuards } from "@nestjs/common";
import type { Response } from "express";
import type { User } from "@prisma/client";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { Actor } from "../auth/actor.decorator";
import { KycService } from "./kyc.service";

@Controller("kyc")
@UseGuards(SessionAuthGuard)
export class KycController {
  constructor(private readonly kyc:KycService){}
  @Get("me") me(@Actor() actor:User){return this.kyc.me(actor);}
  @Get("review-queue") queue(@Actor() actor:User){return this.kyc.queue(actor);}
  @Get("evidence/:evidenceId/sample")
  async sample(@Param("evidenceId") id:string,@Actor() actor:User,@Res() response:Response){
    const file=await this.kyc.sample(id,actor);
    response.setHeader("Content-Type",file.contentType);
    response.setHeader("Content-Disposition",'attachment; filename="synthetic-sample"');
    response.setHeader("Cache-Control","private, no-store");
    response.setHeader("X-Content-Type-Options","nosniff");
    response.send(file.bytes);
  }
  @Get(":userId") get(@Param("userId") id:string,@Actor() actor:User){return this.kyc.get(id,actor);}
  @Post("evidence") submit(@Actor() actor:User,@Body() body:unknown){return this.kyc.submit(actor,body);}
  @Post(":userId/review") review(@Param("userId") id:string,@Actor() actor:User,@Body() body:unknown){return this.kyc.review(id,actor,body);}
}
