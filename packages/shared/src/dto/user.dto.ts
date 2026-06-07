import { z } from 'zod';
import { UserRole } from '../constants/roles';

export const CreateUserSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a digit'),
  fullName: z.string().min(2, 'Full name too short').max(100, 'Full name too long'),
  role: z.nativeEnum(UserRole).optional().default(UserRole.USER),
});
export type CreateUserDto = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = z.object({
  fullName: z.string().min(2).max(100).optional(),
  role: z.nativeEnum(UserRole).optional(),
  isActive: z.boolean().optional(),
});
export type UpdateUserDto = z.infer<typeof UpdateUserSchema>;

export const UserQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional().default(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  search: z.string().optional(),
  role: z.nativeEnum(UserRole).optional(),
});
export type UserQueryDto = z.infer<typeof UserQuerySchema>;
