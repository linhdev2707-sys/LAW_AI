import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class InternalHistoryMessageDto {
  @ApiProperty({ enum: ['user', 'assistant'] })
  @IsString()
  role!: 'user' | 'assistant';

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  content!: string;
}

export class InternalSendMessageDto {
  @ApiProperty({ example: 'Hợp đồng thuê nhà hết hạn xử lý sao?' })
  @IsString()
  @MinLength(1)
  @MaxLength(8000)
  content!: string;

  @ApiPropertyOptional({
    description:
      'Tin nhắn lịch sử (tối đa vài lượt gần nhất) để giữ ngữ cảnh hội thoại. Không bắt buộc.',
    type: [InternalHistoryMessageDto],
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InternalHistoryMessageDto)
  history?: InternalHistoryMessageDto[];
}
