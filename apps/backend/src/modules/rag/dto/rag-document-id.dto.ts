import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class RagDocumentIdParamDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID()
  id!: string;
}
