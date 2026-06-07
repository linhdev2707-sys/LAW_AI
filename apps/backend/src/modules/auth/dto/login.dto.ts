import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'user@law.ai' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Test1234' })
  @IsString()
  @MinLength(1)
  password!: string;
}
