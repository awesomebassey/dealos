import { Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import type { User } from "@prisma/client";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { Actor } from "../auth/actor.decorator";
import { DataRoomService } from "./data-room.service";

@Controller("data-room")
@UseGuards(SessionAuthGuard)
export class DataRoomController {
  constructor(private readonly dataRoom: DataRoomService) {}

  @Get("deals/:dealId/documents")
  list(@Param("dealId") dealId: string, @Actor() actor: User) {
    return this.dataRoom.list(dealId, actor);
  }

  @Post("documents/:documentId/access")
  access(
    @Param("documentId") documentId: string,
    @Query("dealId") dealId: string,
    @Actor() actor: User,
  ) {
    return this.dataRoom.access(documentId, dealId, actor);
  }
}
