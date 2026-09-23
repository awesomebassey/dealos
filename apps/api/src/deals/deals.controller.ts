import {
  Body,
  Controller,
  Get,
  MessageEvent,
  Param,
  Post,
  Query,
  Sse,
  UseGuards,
} from "@nestjs/common";
import type { User } from "@prisma/client";
import { Observable, concatMap, from, interval, map, switchMap } from "rxjs";
import { DealsService } from "./deals.service";
import { AuditService } from "../audit/audit.service";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { Actor } from "../auth/actor.decorator";
import { serialize } from "../common/serialize";

@Controller("deals")
@UseGuards(SessionAuthGuard)
export class DealsController {
  constructor(
    private readonly deals: DealsService,
    private readonly audit: AuditService,
  ) {}

  @Get()
  list(@Actor() actor: User) {
    return this.deals.list(actor);
  }

  @Get(":id")
  get(@Param("id") id: string, @Actor() actor: User) {
    return this.deals.get(id, actor);
  }

  @Post(":id/nda/sign")
  signNda(@Param("id") id: string, @Actor() actor: User) {
    return this.deals.signNda(id, actor);
  }

  @Post(":id/transition")
  transition(@Param("id") id: string, @Actor() actor: User, @Body() body: unknown) {
    return this.deals.transition(id, actor, body);
  }

  @Post(":id/assets/:itemId/confirm")
  confirmAsset(@Param("id") id:string,@Param("itemId") itemId:string,@Actor() actor:User){
    return this.deals.confirmAsset(id,itemId,actor);
  }

  @Sse(":id/events")
  events(
    @Param("id") id: string,
    @Actor() actor: User,
    @Query("since") since?: string,
  ): Observable<MessageEvent> {
    let cursor = since ? new Date(since) : new Date(Date.now() - 60_000);
    return from(this.deals.assertCanStream(id, actor)).pipe(
      switchMap(() => interval(2000)),
      concatMap(() => from(this.audit.listForDeal(id, cursor))),
      concatMap((events) => from(events)),
      map((event) => {
        cursor = event.createdAt;
        return { id: event.id, type: "message", data: serialize(event) } as MessageEvent;
      }),
    );
  }
}
