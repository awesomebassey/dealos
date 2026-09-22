import { Body, Controller, Get, Param, Post, UseGuards } from "@nestjs/common";
import type { User } from "@prisma/client";
import { SessionAuthGuard } from "../auth/session-auth.guard";
import { Actor } from "../auth/actor.decorator";
import { DiligenceService } from "./diligence.service";

@Controller("diligence")
@UseGuards(SessionAuthGuard)
export class DiligenceController {
  constructor(private readonly diligence: DiligenceService) {}

  @Get("deals/:dealId")
  get(@Param("dealId") dealId: string, @Actor() actor: User) {
    return this.diligence.get(dealId, actor);
  }

  @Post("deals/:dealId/questions/:questionId/answer")
  answer(@Param("dealId") dealId: string, @Param("questionId") questionId: string,
    @Actor() actor: User, @Body() body: unknown) {
    return this.diligence.answer(dealId, questionId, actor, body);
  }

  @Post("deals/:dealId/run")
  run(@Param("dealId") dealId: string, @Actor() actor: User) {
    return this.diligence.run(dealId, actor);
  }
}
