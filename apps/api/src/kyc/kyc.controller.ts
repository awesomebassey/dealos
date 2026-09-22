import { Controller, Get, Param, UseGuards } from "@nestjs/common";
import type { User } from "@prisma/client";
import { DemoAuthGuard } from "../auth/demo-auth.guard";
import { Actor } from "../auth/actor.decorator";
import { KycService } from "./kyc.service";

@Controller("kyc")
@UseGuards(DemoAuthGuard)
export class KycController {
  constructor(private readonly kyc: KycService) {}

  @Get("me")
  me(@Actor() actor: User) {
    return this.kyc.me(actor);
  }

  @Get(":userId")
  get(@Param("userId") userId: string, @Actor() actor: User) {
    return this.kyc.get(userId, actor);
  }
}
