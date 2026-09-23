import { Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import type { User } from "@prisma/client";
import { Actor } from "../auth/actor.decorator";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { NotificationsService } from "./notifications.service";

@Controller("notifications")
@UseGuards(SessionAuthGuard)
export class NotificationsController {
  constructor(private readonly notifications:NotificationsService) {}
  @Get() list(@Actor() actor:User,@Query("page") page?:string){
    return this.notifications.list(actor.id,page);
  }
  @Post("read-all") readAll(@Actor() actor:User){return this.notifications.readAll(actor.id);}
  @Post(":id/read") read(@Actor() actor:User,@Param("id") id:string){
    return this.notifications.read(actor.id,id);
  }
}
