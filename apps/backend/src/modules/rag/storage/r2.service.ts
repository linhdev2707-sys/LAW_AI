import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

/**
 * Cloudflare R2 is S3-compatible. We use the AWS SDK v3 with a custom
 * endpoint so PUT/DELETE work transparently against R2 buckets.
 */
@Injectable()
export class R2Service implements OnModuleInit {
  private readonly logger = new Logger(R2Service.name);
  private client: S3Client | null = null;
  private bucket = '';
  private enabled = false;

  constructor(private readonly config: ConfigService) {}

  onModuleInit(): void {
    const accountId = this.config.get<string>('app.r2.accountId', '');
    const accessKeyId = this.config.get<string>('app.r2.accessKeyId', '');
    const secretAccessKey = this.config.get<string>('app.r2.secretAccessKey', '');
    const endpoint =
      this.config.get<string>('app.r2.endpoint', '') ||
      (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : '');
    this.bucket = this.config.get<string>('app.r2.bucket', 'law-ai-rag');
    const region = this.config.get<string>('app.r2.region', 'auto');

    if (!accessKeyId || !secretAccessKey || !endpoint) {
      this.logger.warn('R2 credentials missing — document upload to R2 is disabled.');
      this.enabled = false;
      return;
    }
    this.client = new S3Client({
      region,
      endpoint,
      credentials: { accessKeyId, secretAccessKey },
    });
    this.enabled = true;
    this.logger.log(`R2 client initialised (bucket=${this.bucket})`);
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  async putObject(key: string, body: string | Buffer, contentType: string): Promise<void> {
    this.assertReady();
    await this.client!.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
      }),
    );
  }

  async deleteObject(key: string): Promise<void> {
    this.assertReady();
    await this.client!.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  private assertReady(): void {
    if (!this.enabled || !this.client) {
      throw new Error('R2 client not configured');
    }
  }
}
