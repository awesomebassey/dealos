import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
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
  @Get(":userId") get(@Param("userId") id:string,@Actor() actor:User){return this.kyc.get(id,actor);}
  @Post("evidence") submit(@Actor() actor:User,@Body() body:unknown){return this.kyc.submit(actor,body);}
  @Post(":userId/review") review(@Param("userId") id:string,@Actor() actor:User,@Body() body:unknown){return this.kyc.review(id,actor,body);}
}
