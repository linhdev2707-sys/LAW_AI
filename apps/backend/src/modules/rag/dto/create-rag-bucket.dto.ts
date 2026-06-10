import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { R2_BUCKET_NAME_REGEX } from '../storage/r2.service';

/**
 * Body for `POST /admin/rag/buckets` — creates a new R2 bucket (idempotent).
 * If a bucket with the same name already exists in the R2 account, the
 * service returns 200 instead of 409.
 */
export class CreateRagBucketDto {
  @ApiProperty({
    example: 'law-ai-rag-civil-code-2015',
    description: 'Globally-unique R2 bucket name. Lowercase, digits, hyphens, 3-63 chars.',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(63)
  @Matches(R2_BUCKET_NAME_REGEX, {
    message: 'name must match R2 naming rules (lowercase, digits, hyphens, 3-63 chars)',
  })
  name!: string;

  @ApiPropertyOptional({
    example: 'auto',
    description: "R2 region. Defaults to 'auto' (R2 figures it out).",
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  region?: string;
}
