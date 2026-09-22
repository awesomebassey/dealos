import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Request, Response } from "express";
import type { User, Session } from "@prisma/client";
import { Actor } from "./actor.decorator";
import { CurrentSession } from "./session.decorator";
import { AuthService } from "./auth.service";
import {
  CSRF_COOKIE,
  SESSION_COOKIE,
  SessionAuthGuard,
} from "./session-auth.guard";

const sevenDays = 7 * 24 * 60 * 60 * 1000;

function cookieOptions(httpOnly: boolean) {
  return {
    httpOnly,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: sevenDays,
  };
}

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  private meta(request: Request) {
    return {
      userAgent: request.headers["user-agent"],
      ipAddress: request.ip,
    };
  }

  private setSession(response: Response, session: { token:string; csrfToken:string }) {
    response.cookie(SESSION_COOKIE, session.token, cookieOptions(true));
    response.cookie(CSRF_COOKIE, session.csrfToken, cookieOptions(false));
  }

  @Post("register")
  async register(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const session = await this.auth.register(body, this.meta(req));
    this.setSession(res, session);
    return { user: session.user };
  }

  @Post("login")
  async login(@Body() body: unknown, @Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const session = await this.auth.login(body, this.meta(req));
    this.setSession(res, session);
    return { user: session.user };
  }

  @Get("me")
  @UseGuards(SessionAuthGuard)
  me(@Actor() actor: User) {
    return this.auth.me(actor.id);
  }

  @Post("logout")
  @UseGuards(SessionAuthGuard)
  async logout(@CurrentSession() session: Session, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(session.id);
    res.clearCookie(SESSION_COOKIE, { path: "/" });
    res.clearCookie(CSRF_COOKIE, { path: "/" });
    return { ok: true };
  }

  @Post("forgot-password")
  forgotPassword(@Body() body: unknown) {
    return this.auth.forgotPassword(body);
  }

  @Post("reset-password")
  resetPassword(@Body() body: unknown) {
    return this.auth.resetPassword(body);
  }

  @Post("change-password")
  @UseGuards(SessionAuthGuard)
  changePassword(@Actor() actor: User, @Body() body: unknown) {
    return this.auth.changePassword(actor.id, body);
  }
}
