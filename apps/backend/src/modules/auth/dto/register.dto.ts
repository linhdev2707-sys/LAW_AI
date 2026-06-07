import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MaxLength, MinLength, Matches } from 'class-validator';

export class RegisterDto {
  @ApiProperty({ example: 'user@law.ai' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'Test1234' })
  @IsString()
  @MinLength(8)
  @MaxLength(100)
  @Matches(/[A-Z]/, { message: 'Password must contain an uppercase letter' })
  @Matches(/[a-z]/, { message: 'Password must contain a lowercase letter' })
  @Matches(/[0-9]/, { message: 'Password must contain a digit' })
  password!: string;

  @ApiProperty({ example: 'Test User' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName!: string;
}
