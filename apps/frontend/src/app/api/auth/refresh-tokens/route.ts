/**
 * Custom NextAuth route: re-issue the session JWT with fresh access/refresh
 * tokens from the BE.
 *
 * Why a custom route?
 *   NextAuth v4 with `session.strategy: "jwt"` only allows updating the
 *   session token via its built-in `update()` flow (which requires the
 *   `useSession` React hook). For our refresh-on-401 interceptor (called
 *   outside React, in plain TS), we need a way to set a new session
 *   cookie directly. This route does that by re-encoding the JWT with
 *   the new tokens, mirroring what the `jwt` callback in lib/auth.ts
 *   would do on the next session read.
 *
 * Flow:
 *   1. Client (api.ts) gets a new pair from /api/v1/auth/refresh
 *   2. Client POSTs here with { accessToken, refreshToken }
 *   3. We read the existing JWT cookie to preserve id/role
 *   4. We encode a fresh JWT containing { id, role, accessToken, refreshToken }
 *   5. We set the same cookie name (default: next-auth.session-token)
 *   6. Next getSession() call on the client sees the new token
 */
import { NextResponse } from 'next/server';
import { encode } from 'next-auth/jwt';
import { getToken } from 'next-auth/jwt';
import { env } from '@/lib/env';

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as {
      accessToken?: string;
      refreshToken?: string;
    };
    if (!body.accessToken) {
      return NextResponse.json({ error: 'Missing accessToken' }, { status: 400 });
    }

    // Read the current session JWT to keep the user identity (id, role).
    // We use a synthetic NextRequest to satisfy the NextAuth helper API.
    const current = await getToken({
      req: req as unknown as Parameters<typeof getToken>[0]['req'],
      secret: env.nextAuthSecret,
    }).catch(() => null);

    const newToken = await encode({
      token: {
        id: current?.id,
        role: current?.role,
        name: current?.name,
        email: current?.email,
        picture: current?.picture,
        sub: current?.sub,
        accessToken: body.accessToken,
        refreshToken: body.refreshToken ?? current?.refreshToken,
      },
      secret: env.nextAuthSecret,
      maxAge: 30 * 24 * 60 * 60, // 30 days, matches default NextAuth JWT TTL
    });

    // Pick the cookie name based on whether we're in dev (http) or prod (https).
    const isProd = process.env.NODE_ENV === 'production';
    const cookieName = isProd
      ? '__Secure-next-auth.session-token'
      : 'next-auth.session-token';

    const response = NextResponse.json({ ok: true });
    response.cookies.set({
      name: cookieName,
      value: newToken,
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: isProd,
      maxAge: 30 * 24 * 60 * 60,
    });
    return response;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
