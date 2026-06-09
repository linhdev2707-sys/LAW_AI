import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { IJwtPayload, UserRole } from '@law-ai/shared';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';

/**
 * Route-level role check. Reads the roles required by `@Roles(...)` and
 * compares them to `request.user.role` populated by `JwtStrategy`.
 *
 * MUST be combined with `JwtAuthGuard` (or any guard that puts an
 * `IJwtPayload` on `request.user`).
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) return true;

    const req = context.switchToHttp().getRequest<{ user?: IJwtPayload }>();
    const user = req.user;
    if (!user) {
      throw new ForbiddenException('Missing authenticated user');
    }
    if (!required.includes(user.role)) {
      throw new ForbiddenException(`Requires role: ${required.join(' | ')}`);
    }
    return true;
  }
}
