/**
 * iLaw — OCR Worker (Cron-Triggered)
 *
 * Runs on a cron schedule (default: every minute). Each tick:
 *  1. List objects in R2 under the `ocr-inbox/` prefix.
 *  2. For each object not yet recorded in the `OCR_STATE` KV namespace:
 *     - Read the raw PDF bytes from R2.
 *     - Pass them to Cloudflare Workers AI
 *       (@cf/meta/llama-3.2-11b-vision-instruct) with a Vietnamese
 *       OCR prompt.
 *     - POST the extracted text back to the backend's callback endpoint
 *       with an HMAC-SHA256 signature in `X-OCR-Signature`.
 *     - Mark the object as processed in KV (with a 7-day TTL so the
 *       namespace doesn't grow forever — PDFs themselves stay in R2
 *       for the backend to clean up via its lifecycle policy).
 *
 * Why cron instead of R2 Event Notifications: Event Notifications require
 * a paid Workers plan ($5/mo). The free plan allows 5 cron triggers per
 * Worker, so we trade real-time latency (≤ 60s) for cost. See the plan
 * file for the trade-off discussion.
 *
 * Idempotency: the KV marker is the source of truth for "already
 * processed". A concurrent invocation (rare, but possible during
 * deploys) that sees the same unprocessed key will both fire the
 * callback — the backend's 409 on duplicate `completeOcr` keeps the
 * state consistent.
 */

interface Env {
  /** R2 binding (bucket = law-ai-rag-ocr). */
  R2: R2Bucket;
  /** KV namespace tracking which R2 objects have been processed. */
  OCR_STATE: KVNamespace;
  /** Backend callback URL, e.g. https://api.law-ai.example.com/api/v1/admin/rag/documents/ocr-complete */
  BACKEND_CALLBACK_URL: string;
  /** Shared HMAC secret. Set via `wrangler secret put OCR_CALLBACK_SECRET`. */
  OCR_CALLBACK_SECRET: string;
  /** FastAPI OCR Service URL, e.g., http://127.0.0.1:8000/ocr */
  OCR_SERVICE_URL?: string;
  /** Logging level. */
  LOG_LEVEL?: 'debug' | 'info' | 'warn' | 'error';
  /** Cap files processed per cron tick. */
  MAX_FILES_PER_TICK?: string;
  /** Sleep between consecutive OCR calls in the same tick (ms). */
  INTER_FILE_DELAY_MS?: string;
  /** Safety cap on pages per invocation. */
  MAX_PAGES_PER_INVOCATION?: string;
}

/** How long to keep "processed" markers in KV. R2 lifecycle handles
 *  the actual PDF bytes; KV just needs to remember "seen" long enough
 *  to skip it on subsequent ticks. */
const KV_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

function log(
  level: NonNullable<Env['LOG_LEVEL']>,
  msg: string,
  extra?: Record<string, unknown>,
): void {
  const payload: Record<string, unknown> = { level, msg, time: new Date().toISOString() };
  if (extra) Object.assign(payload, extra);
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(payload));
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  // Cloudflare Workers don't have Buffer; chunked base64 encode keeps
  // us within the call-stack limit for large PDFs (50MB cap is well
  // below the Worker memory budget).
  const bytes = new Uint8Array(buf);
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk)) as unknown as number[],
    );
  }
  return btoa(binary);
}

async function hmacSha256Hex(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function documentIdFromKey(key: string): string | null {
  // We accept `ocr-inbox/{uuid}.{ext}` for PDF and images.
  const m = key.match(/^ocr-inbox\/([0-9a-fA-F-]{36})\.(pdf|png|jpg|jpeg|tiff|bmp|gif|webp)$/i);
  return m ? m[1] : null;
}

async function callOcr(env: Env, pdfBytes: Uint8Array, filename: string): Promise<string> {
  const serviceUrl = env.OCR_SERVICE_URL || 'http://127.0.0.1:8000/ocr';
  log('info', `Calling external OCR service at ${serviceUrl} for file ${filename}...`);

  const form = new FormData();
  const blob = new Blob([pdfBytes], { type: 'application/pdf' });
  form.append('file', blob, filename);

  const res = await fetch(serviceUrl, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`OCR Service HTTP ${res.status}: ${errorText}`);
  }

  const json = (await res.json()) as {
    success: boolean;
    text: string;
    filename?: string;
    detail?: string;
  };
  if (!json.success || !json.text) {
    throw new Error(`OCR Service failed: ${json.detail || 'unknown error'}`);
  }

  return json.text;
}

async function postCallback(
  env: Env,
  payload: { documentId: string; text: string; pageCount?: number; error?: string },
): Promise<Response> {
  const body = JSON.stringify(payload);
  const sig = await hmacSha256Hex(env.OCR_CALLBACK_SECRET, body);

  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 15000); // 15s timeout

  try {
    const res = await fetch(env.BACKEND_CALLBACK_URL, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-ocr-signature': `sha256=${sig}`,
      },
      body,
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(id);
  }
}

/**
 * Process a single R2 object. Returns true on success, throws on
 * failure. The caller decides whether to mark the object as processed
 * in KV — we don't mark it on failure, so the next tick will retry.
 */
async function processObject(env: Env, key: string, size: number): Promise<void> {
  const documentId = documentIdFromKey(key);
  if (!documentId) {
    log('warn', 'cannot derive documentId from key', { key });
    // We still mark it as "seen" so we don't keep logging on every tick.
    // The backend will eventually garbage-collect malformed keys.
    await env.OCR_STATE.put(`seen:${key}`, '1', { expirationTtl: KV_TTL_SECONDS });
    return;
  }

  log('info', 'processing PDF', { documentId, key, size });

  try {
    const obj = await env.R2.get(key);
    if (!obj) {
      throw new Error(`R2 object not found: ${key}`);
    }
    const buf = await obj.arrayBuffer();
    const pdfBytes = new Uint8Array(buf);

    const filename = key.split('/').pop() || 'document.pdf';
    const text = await callOcr(env, pdfBytes, filename);
    if (!text) {
      throw new Error('OCR returned empty text');
    }

    const res = await postCallback(env, { documentId, text });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Callback ${res.status}: ${body.slice(0, 500)}`);
    }
    log('info', 'OCR completed and delivered', {
      documentId,
      bytes: text.length,
      status: res.status,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    log('error', 'OCR failed', { documentId, error: msg });

    try {
      log('info', 'Sending error status to backend...', { documentId });
      const res = await postCallback(env, { documentId, text: '', error: msg });
      if (res.ok) {
        log('info', 'Error status successfully delivered to backend', { documentId });
        // Since backend knows it failed, we can mark it as processed in KV so we don't retry.
        // We do this by returning normally (success) without throwing.
        return;
      } else {
        const body = await res.text();
        log('error', 'Failed to deliver error callback to backend', {
          documentId,
          status: res.status,
          response: body.slice(0, 200),
        });
        // If the backend returns 400 (Bad Request), it means the backend rejected the payload
        // (likely because it is running an older version that does not accept the 'error' field).
        // We treat this as a permanent failure to avoid an infinite retry loop.
        if (res.status === 400) {
          log(
            'warn',
            'Backend returned 400 Bad Request. Treating as permanent failure to prevent infinite loop.',
            { documentId },
          );
          return;
        }
      }
    } catch (callbackErr) {
      log('error', 'Exception during error callback delivery', {
        documentId,
        error: callbackErr instanceof Error ? callbackErr.message : String(callbackErr),
      });
    }

    throw e; // bubble up; caller will NOT mark as seen so we retry
  }

  // Success — mark as processed so the next cron tick skips it.
  await env.OCR_STATE.put(`seen:${key}`, '1', { expirationTtl: KV_TTL_SECONDS });
}

export default {
  /**
   * Cron trigger — runs on the schedule declared in wrangler.toml.
   * Lists the R2 prefix, filters for unprocessed PDFs, and OCRs them
   * up to MAX_FILES_PER_TICK.
   */
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    log('info', 'cron tick', {
      cron: event.cron,
      scheduledTime: new Date(event.scheduledTime).toISOString(),
    });

    const maxFiles = parseInt(env.MAX_FILES_PER_TICK || '10', 10);

    let listed;
    try {
      listed = await env.R2.list({ prefix: 'ocr-inbox/' });
    } catch (e: unknown) {
      log('error', 'R2 list failed', { error: e instanceof Error ? e.message : String(e) });
      return;
    }

    const imageExtensions = ['.pdf', '.png', '.jpg', '.jpeg', '.tiff', '.bmp', '.gif', '.webp'];
    const candidates = listed.objects
      .filter((o) => imageExtensions.some((ext) => o.key.toLowerCase().endsWith(ext)))
      .slice(0, maxFiles);

    if (candidates.length === 0) {
      log('debug', 'no files to process in ocr-inbox/', { total: listed.objects.length });
      return;
    }

    let processed = 0;
    let skipped = 0;
    let failed = 0;

    // Throttle consecutive OCR calls so we don't blow past the Workers
    // free-plan CPU/time limit on a 10-file burst. INTER_FILE_DELAY_MS
    // is set via wrangler.toml — 1500ms by default.
    const interFileDelayMs = parseInt(env.INTER_FILE_DELAY_MS || '1500', 10);

    for (const obj of candidates) {
      const seen = await env.OCR_STATE.get(`seen:${obj.key}`);
      if (seen) {
        skipped++;
        continue;
      }
      try {
        await processObject(env, obj.key, obj.size);
        processed++;
      } catch {
        // Error already logged by processObject. We intentionally do
        // NOT mark as seen — the next tick will retry. To avoid an
        // infinite retry loop on a permanently broken PDF, we
        // rely on the backend's `failed` status (set by the callback
        // when the Worker reports an error) to surface this to admins,
        // and on the backend's "delete failed document" path to
        // eventually clean up the inbox key.
        failed++;
      }
      // Pace the next call. We sleep even after failures so a stuck
      // upstream doesn't get hammered — failed files roll over to
      // the next tick anyway.
      if (interFileDelayMs > 0) {
        await new Promise((resolve) => setTimeout(resolve, interFileDelayMs));
      }
    }

    log('info', 'cron tick done', { processed, skipped, failed, total: candidates.length });
  },

  /**
   * Optional HTTP entry for manual smoke-tests. POST a JSON body of
   * `{ key: "ocr-inbox/<uuid>.pdf" }` and the Worker will process that
   * single object end-to-end. Useful for local dev with `wrangler dev`
   * and for ad-hoc retry of a stuck file.
   *
   * Note: this bypasses the KV dedup check — callers are expected to
   * know what they're doing. Use the cron path for normal flow.
   */
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    if (url.pathname !== '/process') {
      return new Response('not found', { status: 404 });
    }
    if (req.method !== 'POST') {
      return new Response('POST only', { status: 405 });
    }
    const body = (await req.json()) as { key?: string };
    if (!body.key) {
      return new Response('missing key', { status: 400 });
    }
    try {
      await processObject(env, body.key, 0);
      return new Response('ok', { status: 200 });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return new Response(`error: ${msg}`, { status: 500 });
    }
  },
};
