import { Body, Controller, Get, Param, Post, Query, Res, UseGuards } from "@nestjs/common";
import type { User } from "@prisma/client";
import type { Response } from "express";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { Actor } from "../auth/actor.decorator";
import { DataRoomService } from "./data-room.service";
@Controller("data-room")
@UseGuards(SessionAuthGuard)
export class DataRoomController {
 constructor(private readonly dataRoom:DataRoomService){}
 @Get("deals/:dealId/documents") list(@Param("dealId") dealId:string,@Actor() actor:User){return this.dataRoom.list(dealId,actor);}
 @Get("listings/:listingId/documents") owned(@Param("listingId") listingId:string,@Actor() actor:User){return this.dataRoom.owned(listingId,actor);}
 @Post("documents") upload(@Actor() actor:User,@Body() body:unknown){return this.dataRoom.upload(actor,body);}
 @Post("documents/:documentId/access") access(@Param("documentId") id:string,@Query("dealId") dealId:string,@Actor() actor:User){return this.dataRoom.access(id,dealId,actor);}
 @Get("documents/:documentId/download")
 async download(@Param("documentId") id:string,@Query("dealId") dealId:string,@Actor() actor:User,@Res() res:Response){
  const file=await this.dataRoom.download(id,dealId,actor);
  res.setHeader("Content-Type",file.mime);
  res.setHeader("Cache-Control","no-store");
  res.setHeader("Content-Disposition",'attachment; filename="sample-document"');
  res.send(file.bytes);
 }
}
