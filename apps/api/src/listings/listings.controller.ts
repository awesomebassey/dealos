import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import type { User } from "@prisma/client";
import { Actor } from "../auth/actor.decorator";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { ListingsService } from "./listings.service";

@Controller("listings")
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  @Get()
  list() {
    return this.listings.list();
  }

  @Get(":slug")
  get(@Param("slug") slug: string) {
    return this.listings.get(slug);
  }

  @Post(":slug/start-deal")
  @UseGuards(SessionAuthGuard)
  startDeal(@Param("slug") slug: string, @Actor() actor: User) {
    return this.listings.startDeal(slug, actor);
  }
}
