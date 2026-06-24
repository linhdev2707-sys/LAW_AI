import { ApiProperty } from '@nestjs/swagger';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsUUID } from 'class-validator';

/**
 * Body for POST /admin/rag/documents/bulk-delete.
 *
 * Capped at 100 ids per call to keep a single request from monopolising
 * the worker pool — the FE can chunk larger selections into multiple
 * calls if it ever needs to.
 */
export class BulkDeleteDocumentsDto {
  @ApiProperty({
    type: [String],
    format: 'uuid',
    minItems: 1,
    maxItems: 100,
    description: 'Danh sách ID tài liệu cần xoá (tối đa 100 mỗi lần).',
  })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(100)
  @IsUUID('4', { each: true })
  ids!: string[];
}
