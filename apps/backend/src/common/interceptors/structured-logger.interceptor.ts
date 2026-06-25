import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { randomUUID } from 'crypto';
import type { Request, Response } from 'express';

/**
 * Phase 5: minimal structured-logging interceptor.
 *
 * What it does:
 *  - Assigns a `x-request-id` (or generates one) and exposes it on the
 *    response so clients can correlate their logs with ours.
 *  - Emits ONE JSON line per request, including:
 *      method, url, status, durationMs, requestId, userId (if any)
 *  - Skips the noisy endpoints (health, swagger) that would otherwise
 *    flood the log stream.
 *
 * Why not nestjs-pino: it requires an extra runtime dep (pino + its
 * worker thread), and the existing codebase already uses NestJS Logger
 * everywhere. This interceptor is the smallest change that gives
 * production-grade observability (one JSON line per request with
 * timing). For full JSON-everywhere logging, swap to nestjs-pino later.
 */
@Injectable()
export class StructuredLoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const req = http.getRequest<Request & { user?: { id?: string } }>();
    const res = http.getResponse<Response>();

    const requestId =
      (req.headers['x-request-id'] as string) ||
      (req.headers['x-correlation-id'] as string) ||
      randomUUID();
    res.setHeader('x-request-id', requestId);
    (req as any).id = requestId;

    const path = req.path ?? req.url;
    if (this.shouldSkip(path)) {
      return next.handle();
    }

    const start = Date.now();
    return next.handle().pipe(
      tap({
        next: () => this.log(req, res, requestId, start, undefined),
        error: (err) => this.log(req, res, requestId, start, err),
      }),
    );
  }

  private log(
    req: Request & { user?: { id?: string }; id?: string },
    res: Response,
    requestId: string,
    start: number,
    err: unknown,
  ): void {
    const durationMs = Date.now() - start;
    const status = err ? ((err as any).status ?? 500) : res.statusCode;
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'log';
    const payload = {
      kind: 'http',
      requestId,
      method: req.method,
      url: req.originalUrl ?? req.url,
      status,
      durationMs,
      userId: req.user?.id ?? null,
      msg: err ? (err as Error).message : undefined,
    };
    const line = JSON.stringify(payload);
    if (level === 'error') this.logger.error(line);
    else if (level === 'warn') this.logger.warn(line);
    else this.logger.log(line);
  }

  private shouldSkip(path: string): boolean {
    return (
      path === '/' ||
      path.startsWith('/api/docs') ||
      path.startsWith('/api/v1/health') ||
      path === '/health' ||
      path === '/favicon.ico'
    );
  }
}
