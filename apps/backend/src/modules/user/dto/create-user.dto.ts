import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserRole } from '@law-ai/shared';
import { ZodValidationPipe } from '@/common/pipes/zod-validation.pipe';
import { CreateUserSchema } from '@law-ai/shared';

export class CreateUserDtoPipe extends ZodValidationPipe<{
  email: string;
  password: string;
  fullName: string;
  role?: UserRole;
}> {
  constructor() {
    super(CreateUserSchema as any);
  }
}

/**
 * Swagger DTO for documentation. Runtime validation is done by zod
 * (CreateUserSchema) via the CreateUserDtoPipe applied at controller level
 * or NestJS class-validator pipes.
 */
export class CreateUserBody {
  @ApiProperty({ example: 'user@law.ai' })
  email!: string;

  @ApiProperty({ example: 'Test1234' })
  password!: string;

  @ApiProperty({ example: 'Test User' })
  fullName!: string;

  @ApiPropertyOptional({ enum: UserRole, default: UserRole.USER })
  role?: UserRole;
}
