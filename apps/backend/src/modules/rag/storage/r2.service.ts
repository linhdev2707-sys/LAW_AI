import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  CreateBucketCommand,
  HeadBucketCommand,
  ListBucketsCommand,
  BucketLocationConstraint,
} from '@aws-sdk/client-s3';

/**
 * R2 bucket naming rules (S3-compatible):
 *  - 3..63 chars
 *  - lowercase letters, digits, hyphens
 *  - must start and end with a letter or digit
 *  - globally unique across Cloudflare (not just our account)
 */
export const R2_BUCKET_NAME_REGEX = /^[a-z0-9](?:[a-z0-9-]{1,61}[a-z0-9])?$/;

/**
 * Cloudflare R2 (S3-compatible) service.
 *
 * One `S3Client` per account — bucket name is supplied per-call, so a
 * single instance can read/write/delete across many buckets without
 * reconnecting.
 *
 * The service is REQUIRED: if any credential is missing we throw during
 * `onModuleInit` so the Nest app fails to boot rather than silently
 * skipping uploads. This matches the "always save to R2" rule.
 */
@Injectable()
export class R2Service implements OnModuleInit {
  private readonly logger = new Logger(R2Service.name);
  private client: S3Client | null = null;
  private region = 'auto';
  private enabled = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const accountId = this.config.get<string>('app.r2.accountId', '');
    const accessKeyId = this.config.get<string>('app.r2.accessKeyId', '');
    const secretAccessKey = this.config.get<string>('app.r2.secretAccessKey', '');
    const endpoint =
      this.config.get<string>('app.r2.endpoint', '') ||
      (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');
    this.region = this.config.get<string>('app.r2.region', 'auto');

    const missing: string[] = [];
    if (!accessKeyId) missing.push('R2_ACCESS_KEY_ID');
    if (!secretAccessKey) missing.push('R2_SECRET_ACCESS_KEY');
    if (!endpoint) missing.push('R2_ENDPOINT (or R2_ACCOUNT_ID)');

    if (missing.length) {
      // Fail-fast: refuse to boot. The caller wants R2 to be mandatory.
      throw new Error(
        `R2 is required but credentials are missing: ${missing.join(', ')}. ` +
          `Set them in .env and restart.`,
      );
    }

    this.client = new S3Client({
      // R2 only supports path-style URLs (`/{bucket}/{key}`). Without
      // `forcePathStyle: true`, the SDK will try virtual-host style
      // (`{bucket}.endpoint/...`) which R2 rejects with a confusing
      // "UnknownError" / no response at all.
      region: this.region === 'auto' ? 'us-east-1' : this.region,
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
      forcePathStyle: true,
      // R2 now requires TLS 1.3. Node 18 (OpenSSL 3.0.x) defaults to
      // TLS 1.2 and offers a narrower cipher list than what R2 expects,
      // leading to `SSL alert number 40 (handshake_failure)`. Forcing
      // TLS 1.3 sidesteps the cipher negotiation entirely.
      tls: true,
      requestHandler: {
        httpsAgent: new (require('https').Agent)({
          minVersion: 'TLSv1.3',
          keepAlive: true,
        }),
      },
    });
    this.enabled = true;
    this.logger.log(`R2 client initialised (endpoint=${endpoint})`);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  // ─── Object ops ────────────────────────────────────────────────────────

  async putObject(
    bucket: string,
    key: string,
    body: string | Buffer,
    contentType: string,
  ): Promise<void> {
    this.assertReady();
    await this.client!.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async deleteObject(bucket: string, key: string): Promise<void> {
    this.assertReady();
    await this.client!.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      }),
    );
  }

  // ─── Bucket ops ───────────────────────────────────────────────────────

  /**
   * List bucket names owned by this account.
   * Returns just the names; we don't expose creation date or owner info.
   */
  async listBuckets(): Promise<string[]> {
    this.assertReady();
    const res = await this.client!.send(new ListBucketsCommand({}));
    return (res.Buckets ?? [])
      .map((b) => b.Name)
      .filter((n): n is string => !!n)
      .sort();
  }

  /**
   * Cheap existence check. Returns true on 200/204, false on 404.
   * Throws on auth errors (we want the user to see the real cause).
   */
  async bucketExists(name: string): Promise<boolean> {
    this.assertReady();
    try {
      await this.client!.send(new HeadBucketCommand({ Bucket: name }));
      return true;
    } catch (e: unknown) {
      // HeadBucket returns 404 when the bucket doesn't exist. Anything
      // else is a real error and should bubble up.
      const err = e as { $metadata?: { httpStatusCode?: number }; name?: string };
      const status = err.$metadata?.httpStatusCode;
      if (status === 404 || err.name === 'NotFound' || err.name === 'NoSuchBucket') {
        return false;
      }
      throw e;
    }
  }

  /**
   * Idempotent: if the bucket already exists we no-op instead of 409-ing.
   * R2 doesn't need a Location constraint for `auto` region; we only set
   * one when the caller asks for an explicit region.
   */
  async createBucket(name: string, region: string = 'auto'): Promise<void> {
    this.assertReady();
    if (await this.bucketExists(name)) {
      this.logger.log(`Bucket "${name}" already exists — skipping create`);
      return;
    }

    const input: { Bucket: string; CreateBucketConfiguration?: { LocationConstraint: BucketLocationConstraint } } = {
      Bucket: name,
    };
    if (region && region !== 'auto') {
      input.CreateBucketConfiguration = {
        LocationConstraint: region as BucketLocationConstraint,
      };
    }
    try {
      await this.client!.send(new CreateBucketCommand(input));
      this.logger.log(`Created R2 bucket "${name}" (region=${region})`);
    } catch (e: unknown) {
      // Race: another request may have created it between exists() and
      // create(). Treat BucketAlreadyExists / 409 as success.
      const err = e as { $metadata?: { httpStatusCode?: number }; name?: string };
      if (err.name === 'BucketAlreadyOwnedByYou' || err.name === 'BucketAlreadyExists') {
        this.logger.log(`Bucket "${name}" already exists (race) — treating as success`);
        return;
      }
      throw e;
    }
  }

  private assertReady(): void {
    if (!this.enabled || !this.client) {
      throw new Error('R2 client not configured');
    }
  }
}
