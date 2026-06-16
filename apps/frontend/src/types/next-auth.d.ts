import type { DefaultSession } from 'next-auth';
import type { UserRole } from '@law-ai/shared';

declare module 'next-auth' {
  interface Session {
    accessToken?: string;
    refreshToken?: string;
    user: {
      id: string;
      role: UserRole;
      subscriptionPlan?: string;
      subscriptionExpiresAt?: string | null;
    } & DefaultSession['user'];
  }

  interface User {
    id: string;
    role: UserRole;
    subscriptionPlan?: string;
    subscriptionExpiresAt?: string | null;
    accessToken: string;
    refreshToken?: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: UserRole;
    subscriptionPlan?: string;
    subscriptionExpiresAt?: string | null;
    accessToken?: string;
    refreshToken?: string;
  }
}
