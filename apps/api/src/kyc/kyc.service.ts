import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { User, UserRole } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { serialize } from "../common/serialize";

@Injectable()
export class KycService {
  constructor(private readonly prisma: PrismaService) {}

  async me(actor: User) {
    const item = await this.prisma.kycCase.findUnique({ where: { userId: actor.id } });
    if (!item) throw new NotFoundException("No KYC case for this user");
    return serialize(item);
  }

  async get(userId: string, actor: User) {
    if (!([UserRole.ADVISOR, UserRole.ADMIN] as UserRole[]).includes(actor.role)) {
      throw new ForbiddenException("Only advisors can inspect another user's KYC case");
    }
    const item = await this.prisma.kycCase.findUnique({
      where: { userId },
      include: { user: { select: { id: true, name: true, email: true, role: true } } },
    });
    if (!item) throw new NotFoundException("KYC case not found");
    return serialize(item);
  }
}
