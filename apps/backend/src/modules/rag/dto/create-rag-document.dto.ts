import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { R2_BUCKET_NAME_REGEX } from '../storage/r2.service';

export class CreateRagDocumentDto {
  @ApiProperty({ example: 'Bộ luật Dân sự 2015 - Chương 1' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiProperty({ description: 'Plain-text content (max 5 MB).' })
  @IsString()
  @MinLength(1)
  @MaxLength(5_000_000)
  content!: string;

  @ApiPropertyOptional({ example: 'text/plain' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  mimeType?: string;

  @ApiProperty({
    description: 'R2 bucket to store the raw content in.',
    example: 'law-ai-rag-civil-code-2015',
  })
  @IsString()
  @MinLength(3)
  @MaxLength(63)
  @Matches(R2_BUCKET_NAME_REGEX, {
    message: 'bucket must match R2 naming rules (lowercase, digits, hyphens, 3-63 chars)',
  })
  bucket!: string;

  @ApiPropertyOptional({
    description: 'Source URL the document was crawled from (if any).',
    example: 'https://thuvienphapluat.vn/van-ban/Bo-luat/Bo-luat-Dan-su-2015-296215.aspx',
  })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  sourceUrl?: string;
}
