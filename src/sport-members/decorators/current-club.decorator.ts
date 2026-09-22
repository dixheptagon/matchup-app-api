import { createParamDecorator, ExecutionContext } from '@nestjs/common';

export const CurrentClub = createParamDecorator(
  (data: unknown, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    return request.club;
  },
);
