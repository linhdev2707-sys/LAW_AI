import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

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
}
