import { Module } from "@nestjs/common";
import { PrismaModule } from "./prisma/prisma.module";
import { HealthModule } from "./health/health.module";
import { AuthModule } from "./auth/auth.module";
import { AuditModule } from "./audit/audit.module";
import { DealsModule } from "./deals/deals.module";
import { DataRoomModule } from "./data-room/data-room.module";
import { DiligenceModule } from "./diligence/diligence.module";
import { EscrowModule } from "./escrow/escrow.module";
import { KycModule } from "./kyc/kyc.module";
import { ListingsModule } from "./listings/listings.module";
import { OutboxWorker } from "./common/outbox.worker";

@Module({
  providers: [OutboxWorker],
  imports: [
    PrismaModule,
    HealthModule,
    AuthModule,
    AuditModule,
    DealsModule,
    DataRoomModule,
    DiligenceModule,
    EscrowModule,
    KycModule,
    ListingsModule,
  ],
})
export class AppModule {}
