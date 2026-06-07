import { getSession } from 'next-auth/react';
import { env } from './env';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly errors?: Record<string, string[]>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface ApiFetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  /** If true, do not attach the Bearer token (for /auth/login, /auth/register) */
  anonymous?: boolean;
}

/**
 * Wrapper around fetch that:
 *  - prepends the BE base URL (env.apiUrl)
 *  - serializes JSON body
 *  - attaches `Authorization: Bearer <accessToken>` from the NextAuth session
 *  - throws ApiError on non-2xx responses
 *  - unwraps { success, data, timestamp } envelopes
 */
export async function apiFetch<T = unknown>(
  path: string,
  options: ApiFetchOptions = {},
): Promise<T> {
  const { body, anonymous, headers, ...rest } = options;

  const finalHeaders: Record<string, string> = {
    Accept: 'application/json',
    ...(headers as Record<string, string> | undefined),
  };
  if (body !== undefined) {
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
  const res = await fetch(url, {
    ...rest,
    headers: finalHeaders,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const contentType = res.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');

  if (!res.ok) {
    if (isJson) {
      const errBody = await res.json().catch(() => ({}));
      throw new ApiError(res.status, errBody.message || res.statusText, errBody.errors);
    }
    throw new ApiError(res.status, res.statusText);
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
