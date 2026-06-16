import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import type { Request } from 'express';
import type { IJwtPayload } from '@law-ai/shared';

/**
 * ThrottlerGuard that uses the authenticated user's `sub` claim as the
 * tracking key when present, falling back to the client IP otherwise.
 *
 * This pairs with `ThrottlerModule.forRootAsync(...)` and is wired up as
 * the *global* throttler guard in AppModule. The standard IP-based key
 * is too coarse when many users share a NAT (offices, mobile carriers)
 * and would cause one abusive client to lock everyone else out.
 */
@Injectable()
export class ThrottlerBehindAuthGuard extends ThrottlerGuard {
  protected override async getTracker(req: Request): Promise<string> {
    const user = req.user as IJwtPayload | undefined;
    if (user?.sub) return `user:${user.sub}`;
    // Fallback to client IP. x-forwarded-for is the standard header set
    // by load balancers / reverse proxies; Express has it normalised on
    // `req.ip` when `app.set('trust proxy', true)` is configured.
    return `ip:${req.ip ?? 'unknown'}`;
  }

  /**
   * ThrottlerGuard throws a plain ThrottlerException (429) but we want
   * to expose the standard `Retry-After` header so clients (and our
   * frontend) can render a proper countdown.
   */
  protected override async throwThrottlingException(
    context: ExecutionContext,
    throttlerLimitDetail: any,
  ): Promise<void> {
    const res = context.switchToHttp().getResponse();
    const retryAfterSec = Math.max(
      1,
      Math.ceil((throttlerLimitDetail.timeToBlockExpire ?? 1000) / 1000),
    );
    res?.setHeader?.('Retry-After', String(retryAfterSec));
    return super.throwThrottlingException(context, throttlerLimitDetail);
  }
}
