import { z } from 'zod';
import { UserRole } from '../constants/roles';

export const CreateUserSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z
    .string()
    .min(8, 'Mật khẩu phải có ít nhất 8 ký tự')
    .regex(/[A-Z]/, 'Mật khẩu phải có ít nhất một chữ hoa')
    .regex(/[a-z]/, 'Mật khẩu phải có ít nhất một chữ thường')
    .regex(/[0-9]/, 'Mật khẩu phải có ít nhất một chữ số'),
  fullName: z.string().min(2, 'Họ tên quá ngắn').max(100, 'Họ tên quá dài'),
  role: z.nativeEnum(UserRole).optional().default(UserRole.USER),
});
export type CreateUserDto = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = z.object({
  fullName: z.string().min(2, 'Họ tên quá ngắn').max(100, 'Họ tên quá dài').optional(),
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
