import { Body, Controller, Get, Param, Post, Res, UseGuards } from "@nestjs/common";
import type { User } from "@prisma/client";
import type { Response } from "express";
import { Actor } from "../auth/actor.decorator";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { ListingVerificationService } from "./listing-verification.service";

@Controller("listing-verification")
@UseGuards(SessionAuthGuard)
export class ListingVerificationController {
  constructor(private readonly verification:ListingVerificationService){}

  @Get("review-queue")
  queue(@Actor() actor:User){return this.verification.queue(actor);}

  @Get(":slug")
  get(@Param("slug") slug:string,@Actor() actor:User){return this.verification.get(slug,actor);}

  @Post(":slug/evidence")
  submit(@Param("slug") slug:string,@Actor() actor:User,@Body() body:unknown){
    return this.verification.submit(slug,actor,body);
  }

  @Get(":slug/evidence/:evidenceId/sample")
  async sample(@Param("slug") slug:string,@Param("evidenceId") id:string,@Actor() actor:User,@Res() res:Response){
    const file=await this.verification.sample(slug,id,actor);
    res.setHeader("Content-Type",file.contentType);
    res.setHeader("Cache-Control","no-store");
    res.setHeader("X-Content-Type-Options","nosniff");
    res.setHeader("Content-Disposition",'attachment; filename="review-sample"');
    return res.send(file.bytes);
  }

  @Post(":slug/review")
  review(@Param("slug") slug:string,@Actor() actor:User,@Body() body:unknown){
    return this.verification.review(slug,actor,body);
  }
}
