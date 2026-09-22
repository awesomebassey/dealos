import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
  ForbiddenException,
} from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { hashToken } from "./password";

export const SESSION_COOKIE = "dealos_session";
export const CSRF_COOKIE = "dealos_csrf";

function readCookie(header: string | undefined, name: string) {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [key, ...value] = part.trim().split("=");
    if (key === name) return decodeURIComponent(value.join("="));
  }
  return undefined;
}

@Injectable()
export class SessionAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest();
    const token = readCookie(request.headers.cookie, SESSION_COOKIE);
    if (!token) throw new UnauthorizedException("Sign in to continue");

    const session = await this.prisma.session.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });

    if (!session || session.expiresAt <= new Date()) {
      if (session) await this.prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
      throw new UnauthorizedException("Your session has expired");
    }

    const method = String(request.method).toUpperCase();
    if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
      const csrf = request.headers["x-csrf-token"];
      if (!csrf || Array.isArray(csrf) || hashToken(String(csrf)) !== session.csrfTokenHash) {
        throw new ForbiddenException("Invalid request token");
      }
    }

    request.actor = session.user;
    request.authSession = session;

    if (Date.now() - session.lastSeenAt.getTime() > 5 * 60 * 1000) {
      void this.prisma.session.update({
        where: { id: session.id },
        data: { lastSeenAt: new Date() },
      }).catch(() => undefined);
    }

    return true;
  }
}
