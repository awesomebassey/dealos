import { Body, Controller, Param, Post, UseGuards } from "@nestjs/common";
import type { User } from "@prisma/client";
import { Actor } from "../auth/actor.decorator";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { OffersService } from "./offers.service";
@Controller("offers")
@UseGuards(SessionAuthGuard)
export class OffersController {
 constructor(private readonly service:OffersService){}
 @Post("deals/:dealId") submit(@Param("dealId") id:string,@Actor() actor:User,@Body() body:unknown){return this.service.submit(id,actor,body);}
 @Post("deals/:dealId/accept") accept(@Param("dealId") id:string,@Actor() actor:User){return this.service.respond(id,actor,true);}
 @Post("deals/:dealId/decline") decline(@Param("dealId") id:string,@Actor() actor:User){return this.service.respond(id,actor,false);}
}
