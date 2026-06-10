import type { NextAuthOptions, User as NextAuthUser } from 'next-auth';
import CredentialsProvider from 'next-auth/providers/credentials';
import { LoginSchema, type IAuthResponse } from '@law-ai/shared';
import { env } from './env';

/**
 * NextAuth configuration.
 *
 * Auth flow:
 *  1. User submits credentials to /api/auth/callback/credentials
 *  2. NextAuth calls `authorize(credentials)` below
 *  3. We forward the credentials to the BE `/auth/login` endpoint
 *  4. BE returns { user, tokens: { accessToken, refreshToken, expiresIn } }
 *  5. We return the user with `accessToken` attached so the `jwt` callback
 *     can persist it into the session JWT
 *  6. The FE's `apiFetch` reads `session.accessToken` and attaches it as
 *     `Authorization: Bearer <token>` to all BE calls
 *  7. The BE verifies the token with the same secret (JWT_SECRET === NEXTAUTH_SECRET)
 */
export const authOptions: NextAuthOptions = {
  providers: [
    CredentialsProvider({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = LoginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const res = await fetch(`${env.apiUrl}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(parsed.data),
        });

        if (!res.ok) return null;

        const data = (await res.json()) as IApiEnvelope<IAuthResponse>;
        if (!data.success) return null;

        const { user, tokens } = data.data;
        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          role: user.role,
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        } as NextAuthUser;
      },
    }),
  ],
  session: { strategy: 'jwt' },
  pages: {
    signIn: '/login',
  },
  callbacks: {
    /**
     * Called on every sign-in (NextAuth-managed redirect via callbackUrl).
     * - If NextAuth provided a `callbackUrl`, honour it (but only allow same-origin / relative paths).
     * - Otherwise, default to `/chat` (post-login landing).
     */
    async redirect({ url, baseUrl }) {
      // url is what NextAuth was asked to redirect to (callbackUrl on /login).
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      try {
        const parsed = new URL(url);
        if (parsed.origin === baseUrl) return url;
      } catch {
        // ignore
      }
      return `${baseUrl}/chat`;
    },
    async jwt({ token, user, trigger, session }) {
      // Initial sign-in: copy everything from the authorize() result.
      if (user) {
        token.id = (user as any).id;
        token.role = (user as any).role;
        token.accessToken = (user as any).accessToken;
        token.refreshToken = (user as any).refreshToken;
        return token;
      }
      // update() called from the client (e.g. after a token refresh) —
      // merge the new values into the existing token, preserving id/role.
      if (trigger === 'update' && session) {
        if ((session as any).accessToken) token.accessToken = (session as any).accessToken;
        if ((session as any).refreshToken) token.refreshToken = (session as any).refreshToken;
        return token;
      }
      return token;
    },
    async session({ session, token }) {
      (session as any).accessToken = token.accessToken;
      (session as any).refreshToken = token.refreshToken;
      if (session.user) {
        (session.user as any).id = token.id;
        (session.user as any).role = token.role;
      }
      return session;
    },
  },
  secret: env.nextAuthSecret,
  // On Railway/Vercel/behind proxies the `Host` header carries the real
  // public domain. Trusting it lets NextAuth build the right baseUrl for
  // redirects (e.g. signOut callbackUrl) even when NEXTAUTH_URL is missing.
  // `trustHost` was added in next-auth v4.21+; cast for older type defs.
  ...({ trustHost: true } as Record<string, unknown>),
};

/** Helper envelope type for the BE API. */
type IApiEnvelope<T> = { success: true; data: T; timestamp: string };
