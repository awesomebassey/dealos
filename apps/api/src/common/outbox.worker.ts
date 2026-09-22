import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { OutboxStatus } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class OutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxWorker.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.drain(), 3_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  private async drain() {
    try {
      const claimed = await this.prisma.$transaction(async (tx) => {
        const rows = await tx.$queryRaw<Array<{ id: string }>>`
          SELECT id FROM "OutboxEvent"
          WHERE status = 'PENDING' AND "availableAt" <= NOW()
          ORDER BY "createdAt" ASC
          FOR UPDATE SKIP LOCKED
          LIMIT 10
        `;
        if (!rows.length) return [];
        const ids = rows.map((row) => row.id);
        await tx.outboxEvent.updateMany({
          where: { id: { in: ids } },
          data: { status: OutboxStatus.PROCESSING, attempts: { increment: 1 } },
        });
        return tx.outboxEvent.findMany({ where: { id: { in: ids } } });
      });

      for (const event of claimed) {
        try {
          this.logger.log(`Delivered ${event.topic} for ${event.aggregateId}`);
          await this.prisma.outboxEvent.update({
            where: { id: event.id },
            data: { status: OutboxStatus.DELIVERED, deliveredAt: new Date(), lastError: null },
          });
        } catch (error) {
          await this.prisma.outboxEvent.update({
            where: { id: event.id },
            data: {
              status: OutboxStatus.PENDING,
              availableAt: new Date(Date.now() + 30_000),
              lastError: error instanceof Error ? error.message : "Outbox delivery failed",
            },
          });
        }
      }
    } catch (error) {
      this.logger.error(error instanceof Error ? error.message : error);
    }
  }
}
