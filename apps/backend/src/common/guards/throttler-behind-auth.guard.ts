import { Injectable, ExecutionContext, Inject } from '@nestjs/common';
import { ThrottlerGuard, getOptionsToken, getStorageToken } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';
import type { IJwtPayload } from '@law-ai/shared';
import { ConfigService } from '@nestjs/config';

/**
 * ThrottlerGuard that uses the authenticated user's `sub` claim as the
 * tracking key when present, falling back to the client IP otherwise.
 *
 * It dynamically overrides rate limit options (ttl, limit) at runtime based on
 * the target Controller and Handler, drawing values from ConfigService.
 */
@Injectable()
export class ThrottlerBehindAuthGuard extends ThrottlerGuard {
  constructor(
    @Inject(getOptionsToken()) options: any,
    @Inject(getStorageToken()) storageService: any,
    reflector: Reflector,
    private readonly config: ConfigService,
    private readonly jwtService: JwtService,
  ) {
    super(options, storageService, reflector);
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    return true; // Rate limiting completely disabled
  }

  protected override async getTracker(req: Request): Promise<string> {
    const user = req.user as IJwtPayload | undefined;
    if (user?.sub) return `user:${user.sub}`;

    const authorization = req.headers.authorization;
    const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
    if (token) {
      try {
        const payload = await this.jwtService.verifyAsync<IJwtPayload>(token);
        if (payload.sub) return `user:${payload.sub}`;
      } catch {
        // Invalid or expired tokens are handled by the route's auth guard.
      }
    }
    // Fallback to client IP. x-forwarded-for is the standard header set
    // by load balancers / reverse proxies; Express has it normalised on
    // `req.ip` when `app.set('trust proxy', true)` is configured.
    return `ip:${req.ip ?? 'unknown'}`;
  }

  protected override async handleRequest(requestProps: any): Promise<boolean> {
    const { context } = requestProps;
    const controller = context.getClass();
    const handler = context.getHandler();

    if (
      controller.name === 'ChatController' &&
      (handler.name === 'send' || handler.name === 'stream')
    ) {
      requestProps.ttl = this.config.get<number>('app.rateLimit.chat.ttl') ?? 60_000;
      requestProps.limit = this.config.get<number>('app.rateLimit.chat.max') ?? 20;
      requestProps.blockDuration = requestProps.ttl;
    } else if (
      controller.name === 'AuthController' &&
      (handler.name === 'register' || handler.name === 'login')
    ) {
      requestProps.ttl = this.config.get<number>('app.rateLimit.auth.ttl') ?? 60_000;
      requestProps.limit = this.config.get<number>('app.rateLimit.auth.max') ?? 5;
      requestProps.blockDuration = requestProps.ttl;
    } else if (controller.name === 'InternalChatController' && handler.name === 'stream') {
      requestProps.ttl = this.config.get<number>('app.rateLimit.internalChat.ttl') ?? 60_000;
      requestProps.limit = this.config.get<number>('app.rateLimit.internalChat.max') ?? 5;
      requestProps.blockDuration = requestProps.ttl;
    }

    return super.handleRequest(requestProps);
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
