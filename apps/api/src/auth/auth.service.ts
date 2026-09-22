import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { UserRole } from "@prisma/client";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "@dealos/contracts";
import { PrismaService } from "../prisma/prisma.service";
import { hashPassword, hashToken, randomToken, verifyPassword } from "./password";

const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  private userView(user: { id:string; name:string; email:string; role:UserRole; createdAt:Date }) {
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  private async createSession(userId: string, meta: { userAgent?:string; ipAddress?:string }) {
    const token = randomToken();
    const csrfToken = randomToken();
    const session = await this.prisma.session.create({
      data: {
        userId,
        tokenHash: hashToken(token),
        csrfTokenHash: hashToken(csrfToken),
        userAgent: meta.userAgent?.slice(0, 500),
        ipAddress: meta.ipAddress?.slice(0, 100),
        expiresAt: new Date(Date.now() + SESSION_TTL_MS),
      },
      include: { user: true },
    });
    return { token, csrfToken, expiresAt: session.expiresAt, user: this.userView(session.user) };
  }

  async register(payload: unknown, meta: { userAgent?:string; ipAddress?:string }) {
    const input = registerSchema.parse(payload);
    const existing = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw new ConflictException("An account already exists with this email");

    const passwordHash = await hashPassword(input.password);
    const user = await this.prisma.user.create({
      data: {
        name: input.name,
        email: input.email,
        passwordHash,
        role: input.role as UserRole,
        kycCase: {
          create: {
            status: "PENDING",
            country: "Nigeria",
            riskScore: 0,
          },
        },
      },
    });
    return this.createSession(user.id, meta);
  }

  async login(payload: unknown, meta: { userAgent?:string; ipAddress?:string }) {
    const input = loginSchema.parse(payload);
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user || !(await verifyPassword(input.password, user.passwordHash))) {
      throw new UnauthorizedException("Email or password is incorrect");
    }
    return this.createSession(user.id, meta);
  }

  async logout(sessionId: string) {
    await this.prisma.session.delete({ where: { id: sessionId } }).catch(() => undefined);
    return { ok: true };
  }

  async me(userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    return this.userView(user);
  }

  async forgotPassword(payload: unknown) {
    const input = forgotPasswordSchema.parse(payload);
    const user = await this.prisma.user.findUnique({ where: { email: input.email } });
    if (!user) return { ok: true };

    const token = randomToken();
    await this.prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + RESET_TTL_MS),
      },
    });
    await this.prisma.outboxEvent.create({
      data: {
        topic: "auth.password_reset_requested",
        aggregateId: user.id,
        payload: { userId: user.id, email: user.email },
      },
    });

    return process.env.NODE_ENV === "production"
      ? { ok: true }
      : { ok: true, previewResetToken: token };
  }

  async resetPassword(payload: unknown) {
    const input = resetPasswordSchema.parse(payload);
    const reset = await this.prisma.passwordResetToken.findUnique({
      where: { tokenHash: hashToken(input.token) },
    });
    if (!reset || reset.usedAt || reset.expiresAt <= new Date()) {
      throw new BadRequestException("This password reset link is invalid or expired");
    }

    const passwordHash = await hashPassword(input.password);
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: reset.userId }, data: { passwordHash } }),
      this.prisma.passwordResetToken.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
      this.prisma.session.deleteMany({ where: { userId: reset.userId } }),
    ]);
    return { ok: true };
  }

  async changePassword(userId: string, payload: unknown) {
    const input = changePasswordSchema.parse(payload);
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (!(await verifyPassword(input.currentPassword, user.passwordHash))) {
      throw new UnauthorizedException("Current password is incorrect");
    }
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(input.newPassword) },
    });
    return { ok: true };
  }
}
