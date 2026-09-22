import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { User } from "@prisma/client";

export const Actor = createParamDecorator((_data: unknown, context: ExecutionContext): User => {
  const request = context.switchToHttp().getRequest();
  return request.actor;
});
