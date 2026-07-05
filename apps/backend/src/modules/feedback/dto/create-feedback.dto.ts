import { ApiProperty } from '@nestjs/swagger';
import { IsObject } from 'class-validator';

export class CreateFeedbackDto {
  @ApiProperty({
    example: {
      q1: 'Học sinh / Sinh viên',
      q2: 'Có biết một số kiến thức cơ bản',
      q3: ['Dân sự', 'Hình sự'],
    },
  })
  @IsObject()
  responses!: Record<string, any>;
}
