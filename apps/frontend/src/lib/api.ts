import { getSession, signOut } from 'next-auth/react';
import { env } from './env';
import { toast } from 'sonner';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly errors?: Record<string, string[]>,
    /**
     * For 429 responses, the number of seconds the client should wait
     * before retrying. Mirrors the `Retry-After` response header. The
     * chat UI uses this to render a countdown and disable the input.
     */
    public readonly retryAfter?: number,
    /** Stable application error code returned by the backend, when present. */
    public readonly code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** If true, do not attach the Bearer token (for /auth/login, /auth/register, /auth/refresh). */
  anonymous?: boolean;
  /**
   * If true, the request will not be retried after a successful token refresh.
   * Used internally by `refreshAccessToken` to prevent recursive refresh attempts.
   */
  __isRetry?: boolean;
}

/**
 * Wrapper around fetch that:
 *  - prepends the BE base URL (env.apiUrl)
 *  - serializes JSON body
 *  - attaches `Authorization: Bearer <accessToken>` from the NextAuth session
 *  - **automatically refreshes the access token on 401** (single-flight — if
 *    multiple requests 401 in parallel, only one refresh call is made and
 *    the rest wait for the new token, then all retry)
 *  - falls back to `signOut({ callbackUrl: '/login' })` if refresh fails
 *  - throws ApiError on non-2xx responses (after retry)
 *  - unwraps { success, data, timestamp } envelopes
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { body, anonymous, headers, __isRetry, ...rest } = options;

  // Detect FormData so we don't force a JSON Content-Type. Browsers must
  // set the multipart boundary themselves or the server can't parse it.
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData;

  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(headers as Record<string, string> | undefined),
  };
  if (body !== undefined && !isFormData) {
    finalHeaders['Content-Type'] = 'application/json';
  }

  if (!anonymous) {
    const session = await getSession();
    const token = (session as any)?.accessToken as string | undefined;
    if (token) {
      finalHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  const url = path.startsWith('http') ? path : `${env.apiUrl}${path}`;
  let res = await fetch(url, {
    ...rest,
    headers: finalHeaders,
    body: body !== undefined ? (isFormData ? (body as FormData) : JSON.stringify(body)) : undefined,
  });

  // ── Auto refresh on 401 ───────────────────────────────────────────────
  if (res.status === 401 && !anonymous && !__isRetry) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      // Retry the original request once with the fresh token.
      const retryHeaders: Record<string, string> = { ...finalHeaders };
      retryHeaders['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(url, {
        ...rest,
        headers: retryHeaders,
        body:
          body !== undefined ? (isFormData ? (body as FormData) : JSON.stringify(body)) : undefined,
      });
    } else {
      // Refresh failed — the refresh-token is expired/invalid. Kick the
      // user back to the login page. signOut handles the redirect itself.
      toast.error('Phiên đăng nhập đã hết hạn', {
        description: 'Vui lòng đăng nhập lại để tiếp tục.',
      });
      // signOut with callbackUrl: '/login' — NextAuth will route us there
      // and the (protected) layout's auth check will also redirect anyway.
      await signOut({ callbackUrl: '/login', redirect: true });
      // Throw anyway to stop the caller from continuing with stale data.
      throw new ApiError(401, 'Session expired');
    }
  }

  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');

  if (!res.ok) {
    const retryAfterHeader = res.headers.get('retry-after');
    const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : undefined;
    if (isJson) {
      const errBody = await res.json().catch(() => ({}));
      throw new ApiError(
        res.status,
        errBody.message || res.statusText,
        errBody.errors,
        Number.isFinite(retryAfter) ? retryAfter : undefined,
        typeof errBody.error === 'string' ? errBody.error : undefined,
      );
    }
    throw new ApiError(
      res.status,
      res.statusText,
      undefined,
      Number.isFinite(retryAfter) ? retryAfter : undefined,
    );
  }

  if (!isJson) {
    return undefined as T;
  }

  const json = await res.json();
  // Unwrap envelope if present
  if (json && typeof json === 'object' && 'success' in json && 'data' in json) {
    return json.data as T;
  }
  return json as T;
}

// ─── Single-flight refresh ───────────────────────────────────────────────

let refreshInFlight: Promise<string | null> | null = null;

/**
 * Calls POST /api/v1/auth/refresh with the current refresh token from the
 * NextAuth session, stores the new pair via `session.update(...)`, and
 * returns the new access token (or null if the refresh token is dead).
 *
 * Multiple concurrent callers share a single in-flight request.
 */
async function refreshAccessToken(): Promise<string | null> {
  if (refreshInFlight) return refreshInFlight;

  refreshInFlight = (async () => {
    try {
      const session = (await getSession()) as {
        accessToken?: string;
        refreshToken?: string;
      } | null;
      const refreshToken = session?.refreshToken;
      if (!refreshToken) return null;

      // Hit the refresh endpoint anonymously (no Authorization header) and
      // mark __isRetry so the inner call won't try to refresh again.
      const res = await fetch(`${env.apiUrl}/api/v1/auth/refresh`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) return null;

      const envelope = (await res.json().catch(() => null)) as {
        success: boolean;
        data?: {
          accessToken: string;
          refreshToken?: string;
          expiresIn?: number;
        };
      } | null;

      const data = envelope?.data;
      if (!envelope?.success || !data?.accessToken) return null;

      // Persist the new tokens onto the NextAuth JWT cookie via our
      // custom route (see /api/auth/refresh-tokens). This re-encodes
      // the session JWT with the new pair so the next getSession()
      // call on the client sees them. We can't use NextAuth's built-in
      // `update()` from outside React, so we hit our own endpoint.
      await fetch('/api/auth/refresh-tokens', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: data.accessToken,
          refreshToken: data.refreshToken ?? refreshToken,
        }),
      }).catch(() => {
        // Best-effort — even if the cookie write fails, we still
        // return the token so the immediate retry can succeed.
      });

      return data.accessToken;
    } catch {
      return null;
    } finally {
      // Always release the single-flight lock, success or failure.
      refreshInFlight = null;
    }
  })();

  return refreshInFlight;
}
