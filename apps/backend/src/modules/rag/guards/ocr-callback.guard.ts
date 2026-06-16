import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import type { Request } from 'express';

/**
 * Verifies the HMAC signature on the OCR callback request.
 *
 * The Cloudflare Worker signs the raw JSON body with
 *   `X-OCR-Signature: sha256=<hex>`
 * where the key is `OCR_CALLBACK_SECRET`. We recompute the same HMAC
 * over the raw body bytes and constant-time-compare against the header.
 *
 * We intentionally do NOT use JWT auth here — the Worker is a
 * server-to-server caller and we trust HMAC instead.
 */
@Injectable()
export class OcrCallbackGuard implements CanActivate {
  private readonly logger = new Logger(OcrCallbackGuard.name);

  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { rawBody?: Buffer }>();
    const secret = this.config.get<string>('app.ocr.callbackSecret', '');

    if (!secret) {
      // Fail closed: if the operator hasn't configured a secret we
      // refuse all callbacks rather than silently accepting them.
      this.logger.error('OCR callback received but OCR_CALLBACK_SECRET is not configured');
      throw new UnauthorizedException('OCR callback secret not configured on server');
    }

    const header = req.header('x-ocr-signature') || req.header('X-OCR-Signature') || '';
    if (!header) {
      throw new UnauthorizedException('Missing X-OCR-Signature header');
    }

    // The signature header is `sha256=<hex>` per AWS-style convention.
    const provided = header.startsWith('sha256=') ? header.slice('sha256='.length) : header;

    // The raw body must be available on `req.rawBody`. main.ts sets
    // `rawBody: true` on the json body parser, which exposes the buffer
    // here. If the operator forgot to enable it, we fall back to the
    // parsed body string — works in a pinch but is order-sensitive.
    const raw = req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {}));

    const expected = createHmac('sha256', secret).update(raw).digest('hex');

    const a = Buffer.from(provided, 'hex');
    const b = Buffer.from(expected, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      this.logger.warn('OCR callback HMAC verification failed');
      throw new UnauthorizedException('Invalid OCR signature');
    }

    return true;
  }
}
