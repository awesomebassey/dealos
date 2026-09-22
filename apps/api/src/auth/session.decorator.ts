import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { Session } from "@prisma/client";

export const CurrentSession = createParamDecorator((_data: unknown, context: ExecutionContext): Session => {
  return context.switchToHttp().getRequest().authSession;
});
