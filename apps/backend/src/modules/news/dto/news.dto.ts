import { ApiProperty } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateNewsDto {
  @ApiProperty({ example: 'Tiêu đề bài viết' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ example: 'https://example.com/image.jpg' })
  @IsString()
  @IsOptional()
  image?: string;

  @ApiProperty({ example: 'Admin' })
  @IsString()
  @IsOptional()
  source?: string;

  @ApiProperty({ example: 'Nội dung bài viết' })
  @IsString()
  @IsNotEmpty()
  content!: string;
}

export class UpdateNewsDto {
  @ApiProperty({ example: 'Tiêu đề bài viết mới' })
  @IsString()
  @IsNotEmpty()
  title!: string;

  @ApiProperty({ example: 'https://example.com/new-image.jpg' })
  @IsString()
  @IsOptional()
  image?: string;

  @ApiProperty({ example: 'Admin' })
  @IsString()
  @IsOptional()
  source?: string;

  @ApiProperty({ example: 'Nội dung bài viết mới' })
  @IsString()
  @IsNotEmpty()
  content!: string;
}
