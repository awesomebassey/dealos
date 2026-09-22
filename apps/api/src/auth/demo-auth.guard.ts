import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class DemoAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const actorId = request.headers["x-demo-actor"] ?? request.query.actorId;

    if (!actorId || Array.isArray(actorId)) {
      throw new UnauthorizedException("Demo actor is required");
    }

    const actor = await this.prisma.user.findUnique({ where: { id: String(actorId) } });
    if (!actor) throw new UnauthorizedException("Unknown demo actor");

    request.actor = actor;
    return true;
  }
}
