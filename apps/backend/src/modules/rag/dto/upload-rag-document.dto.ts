import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { R2_BUCKET_NAME_REGEX } from '../storage/r2.service';

/**
 * Form fields for `POST /admin/rag/documents/upload` (multipart).
 *
 * The `file` field is NOT part of this DTO — it's read by Multer via
 * `@UploadedFile()` in the controller. The size/type limits are enforced
 * by the FileInterceptor config.
 */
export class UploadRagDocumentDto {
  @ApiProperty({ example: 'Bộ luật Dân sự 2015 - Chương 1', maxLength: 200 })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

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
}
