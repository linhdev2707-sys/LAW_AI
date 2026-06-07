import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { IJwtPayload } from '@law-ai/shared';

export const CurrentUser = createParamDecorator(
  (data: keyof IJwtPayload | undefined, ctx: ExecutionContext): IJwtPayload | string | number | undefined => {
    const request = ctx.switchToHttp().getRequest();
    const user: IJwtPayload | undefined = request.user;
    if (data) {
      return user?.[data];
    }
    return user;
  },
);
