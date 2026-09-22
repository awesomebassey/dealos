import { Body, Controller, Get, Headers, Param, Post, UseGuards } from "@nestjs/common";
import type { User } from "@prisma/client";
import { DemoAuthGuard } from "../auth/demo-auth.guard";
import { Actor } from "../auth/actor.decorator";
import { EscrowService } from "./escrow.service";

@Controller("escrow")
@UseGuards(DemoAuthGuard)
export class EscrowController {
  constructor(private readonly escrow: EscrowService) {}

  @Get("deals/:dealId")
  get(@Param("dealId") dealId: string, @Actor() actor: User) {
    return this.escrow.get(dealId, actor);
  }

  @Post("deals/:dealId/fund")
  fund(
    @Param("dealId") dealId: string,
    @Actor() actor: User,
    @Body() body: unknown,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    return this.escrow.fund(dealId, actor, body, idempotencyKey);
  }

  @Post("deals/:dealId/sign-off")
  signOff(@Param("dealId") dealId: string, @Actor() actor: User, @Body() body: unknown) {
    return this.escrow.signOff(dealId, actor, body);
  }

  @Post("deals/:dealId/platform-confirm")
  platformConfirm(@Param("dealId") dealId: string, @Actor() actor: User) {
    return this.escrow.platformConfirm(dealId, actor);
  }

  @Post("deals/:dealId/release")
  release(
    @Param("dealId") dealId: string,
    @Actor() actor: User,
    @Headers("idempotency-key") idempotencyKey?: string,
  ) {
    return this.escrow.release(dealId, actor, idempotencyKey);
  }
}
