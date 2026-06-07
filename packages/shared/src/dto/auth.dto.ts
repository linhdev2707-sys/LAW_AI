import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z.string().min(1, 'Password is required'),
});
export type LoginDto = z.infer<typeof LoginSchema>;

export const RegisterSchema = z.object({
  email: z.string().email('Invalid email'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain an uppercase letter')
    .regex(/[a-z]/, 'Password must contain a lowercase letter')
    .regex(/[0-9]/, 'Password must contain a digit'),
  fullName: z.string().min(2, 'Full name too short').max(100, 'Full name too long'),
});
export type RegisterDto = z.infer<typeof RegisterSchema>;

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});
export type RefreshTokenDto = z.infer<typeof RefreshTokenSchema>;
