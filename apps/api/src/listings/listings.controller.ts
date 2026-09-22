import { Body, Controller, Get, Param, Post, Query, UseGuards } from "@nestjs/common";
import type { User } from "@prisma/client";
import { Actor } from "../auth/actor.decorator";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { ListingsService } from "./listings.service";

@Controller("listings")
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  @Get()
  list(@Query("page") page?:string,@Query("q") q?:string,@Query("category") category?:string) {
    return this.listings.list({page,q,category});
  }

  @Get("mine")
  @UseGuards(SessionAuthGuard)
  mine(@Actor() actor:User) {return this.listings.mine(actor);}

  @Post()
  @UseGuards(SessionAuthGuard)
  create(@Actor() actor:User,@Body() body:unknown){return this.listings.create(actor,body);}

  @Get(":slug")
  get(@Param("slug") slug:string){return this.listings.get(slug);}

  @Post(":slug/publish")
  @UseGuards(SessionAuthGuard)
  publish(@Param("slug") slug:string,@Actor() actor:User){return this.listings.publish(slug,actor);}

  @Post(":slug/start-deal")
  @UseGuards(SessionAuthGuard)
  startDeal(@Param("slug") slug:string,@Actor() actor:User){return this.listings.startDeal(slug,actor);}
}
