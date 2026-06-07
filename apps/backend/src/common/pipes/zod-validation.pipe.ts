import { BadRequestException, PipeTransform } from '@nestjs/common';
import { ZodSchema } from 'zod';
import { formatZodErrors } from '@law-ai/shared';

export class ZodValidationPipe<T> implements PipeTransform<unknown, T> {
  constructor(private readonly schema: ZodSchema<T>) {}

  transform(value: unknown): T {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        message: 'Validation failed',
        errors: formatZodErrors(result.error),
      });
    }
    return result.data;
  }
}
