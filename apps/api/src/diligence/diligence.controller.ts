import { Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import type { User } from "@prisma/client";
import { DemoAuthGuard } from "../auth/demo-auth.guard";
import { Actor } from "../auth/actor.decorator";
import { DiligenceService } from "./diligence.service";

@Controller("diligence")
@UseGuards(DemoAuthGuard)
export class DiligenceController {
  constructor(private readonly diligence: DiligenceService) {}

  @Get("deals/:dealId")
  get(@Param("dealId") dealId: string, @Actor() actor: User) {
    return this.diligence.get(dealId, actor);
  }

  @Post("deals/:dealId/run")
  run(@Param("dealId") dealId: string, @Actor() actor: User) {
    return this.diligence.run(dealId, actor);
  }
}
