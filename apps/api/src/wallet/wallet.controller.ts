import { Body, Controller, Get, Headers, Post, UseGuards } from "@nestjs/common";
import type { User } from "@prisma/client";
import { Actor } from "../auth/actor.decorator";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { WalletService } from "./wallet.service";
@Controller("wallet")
@UseGuards(SessionAuthGuard)
export class WalletController {
  constructor(private readonly service:WalletService){}
  @Get() get(@Actor() actor:User){return this.service.get(actor);}
  @Post("demo-topup") topup(@Actor() actor:User,@Body() body:unknown,@Headers("idempotency-key") key?:string){return this.service.topup(actor,body,key);}
}
