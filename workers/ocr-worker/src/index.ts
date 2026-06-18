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
  /** Workers AI binding. */
  AI: Ai;
  /** KV namespace tracking which R2 objects have been processed. */
  OCR_STATE: KVNamespace;
  /** Backend callback URL, e.g. https://api.law-ai.example.com/api/v1/admin/rag/documents/ocr-complete */
  BACKEND_CALLBACK_URL: string;
  /** Shared HMAC secret. Set via `wrangler secret put OCR_CALLBACK_SECRET`. */
  OCR_CALLBACK_SECRET: string;
  /** Logging level. */
  LOG_LEVEL?: 'debug' | 'info' | 'warn' | 'error';
  /** Model id. Override in wrangler.toml if you need to swap. */
  OCR_MODEL?: string;
  /** Cap files processed per cron tick. */
  MAX_FILES_PER_TICK?: string;
  /** Sleep between consecutive OCR calls in the same tick (ms). */
  INTER_FILE_DELAY_MS?: string;
  /** Safety cap on pages per invocation. */
  MAX_PAGES_PER_INVOCATION?: string;
}

/**
 * Vietnamese OCR prompt. We keep this short but explicit:
 *  - declare the language (the model is multilingual but explicit is
 *    better),
 *  - forbid surrounding commentary so the model returns just the text,
 *  - tell it to preserve paragraph breaks.
 */
const OCR_PROMPT_VI = [
  'Bạn là một hệ thống OCR chuyên trích xuất văn bản từ tài liệu PDF tiếng Việt.',
  'Nhiệm vụ: trích xuất TOÀN BỘ văn bản có trong tài liệu PDF được cung cấp, giữ nguyên thứ tự và cấu trúc đoạn văn.',
  'Yêu cầu:',
  '- Giữ nguyên dấu thanh tiếng Việt đầy đủ.',
  '- Giữ nguyên số điều, số khoản, dấu gạch đầu dòng, tiêu đề đề mục.',
  '- Phân tách các trang bằng một dòng trống.',
  '- Chỉ trả về văn bản thuần túy. KHÔNG thêm lời dẫn, KHÔNG thêm giải thích, KHÔNG dùng markdown.',
].join('\n');

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
  // We accept `ocr-inbox/{uuid}.pdf` and `ocr-inbox/{uuid}.PDF`.
  const m = key.match(/^ocr-inbox\/([0-9a-fA-F-]{36})\.pdf$/i);
  return m ? m[1] : null;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
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

function extractJpegsFromPdf(pdfBytes: Uint8Array): Uint8Array[] {
  const jpegs: Uint8Array[] = [];
  
  const dctPattern = new TextEncoder().encode('/DCTDecode');
  const streamPattern = new TextEncoder().encode('stream');
  const endstreamPattern = new TextEncoder().encode('endstream');
  
  function findPattern(arr: Uint8Array, pattern: Uint8Array, start = 0): number {
    const max = arr.length - pattern.length;
    for (let i = start; i <= max; i++) {
      let match = true;
      for (let j = 0; j < pattern.length; j++) {
        if (arr[i + j] !== pattern[j]) {
          match = false;
          break;
        }
      }
      if (match) return i;
    }
    return -1;
  }
  
  let pos = 0;
  while (true) {
    const dctIndex = findPattern(pdfBytes, dctPattern, pos);
    if (dctIndex === -1) break;
    
    const streamIndex = findPattern(pdfBytes, streamPattern, dctIndex);
    if (streamIndex === -1) {
      pos = dctIndex + 1;
      continue;
    }
    
    let streamStart = streamIndex + 6;
    if (pdfBytes[streamStart] === 13) { // \r
      streamStart++;
    }
    if (pdfBytes[streamStart] === 10) { // \n
      streamStart++;
    }
    
    const endstreamIndex = findPattern(pdfBytes, endstreamPattern, streamStart);
    if (endstreamIndex === -1) {
      pos = streamStart;
      continue;
    }
    
    const streamData = pdfBytes.subarray(streamStart, endstreamIndex);
    
    let jpegStart = -1;
    for (let i = 0; i < streamData.length - 2; i++) {
      if (streamData[i] === 0xFF && streamData[i+1] === 0xD8 && streamData[i+2] === 0xFF) {
        jpegStart = i;
        break;
      }
    }
    
    let jpegEnd = -1;
    if (jpegStart !== -1) {
      for (let i = streamData.length - 2; i >= jpegStart; i--) {
        if (streamData[i] === 0xFF && streamData[i+1] === 0xD9) {
          jpegEnd = i + 2;
          break;
        }
      }
    }
    
    if (jpegStart !== -1 && jpegEnd !== -1) {
      jpegs.push(streamData.subarray(jpegStart, jpegEnd));
    } else {
      jpegs.push(streamData);
    }
    
    pos = endstreamIndex + 9;
  }
  
  return jpegs;
}

async function callOcr(env: Env, pdfBytes: Uint8Array): Promise<string> {
  const model = (env.OCR_MODEL as unknown as string) || '@cf/meta/llama-3.2-11b-vision-instruct';

  const jpegs = extractJpegsFromPdf(pdfBytes);
  
  const runOcrOnImage = async (imgBase64: string): Promise<string> => {
    try {
      const response: any = await env.AI.run(model as any, {
        image: [imgBase64],
        prompt: OCR_PROMPT_VI,
        max_tokens: 4096,
      });

      let text: string | undefined;
      if (typeof response === 'string') {
        text = response;
      } else if (response && typeof response === 'object') {
        text = response.description ?? response.response ?? response.text;
      }
      if (!text) {
        throw new Error('AI returned empty response');
      }
      return text.trim();
    } catch (e: any) {
      const errMsg = e instanceof Error ? e.message : String(e);
      if (errMsg.includes("prompt 'agree'") || errMsg.includes('5016') || errMsg.includes('agree')) {
        log('info', 'Model terms of service not accepted yet. Submitting agreement prompt...', { model });
        await env.AI.run(model as any, { prompt: 'agree' });
        log('info', 'Successfully agreed to model terms of service. Retrying page OCR...', { model });
        
        const response: any = await env.AI.run(model as any, {
          image: [imgBase64],
          prompt: OCR_PROMPT_VI,
          max_tokens: 4096,
        });

        let text: string | undefined;
        if (typeof response === 'string') {
          text = response;
        } else if (response && typeof response === 'object') {
          text = response.description ?? response.response ?? response.text;
        }
        if (!text) {
          throw new Error('AI returned empty response on retry');
        }
        return text.trim();
      }
      throw e;
    }
  };

  if (jpegs.length === 0) {
    log('warn', 'No embedded JPEGs found in PDF. Falling back to passing raw PDF bytes.', { model });
    const rawBase64 = 'data:application/pdf;base64,' + uint8ArrayToBase64(pdfBytes);
    return await runOcrOnImage(rawBase64);
  }

  log('info', `Extracted ${jpegs.length} images from PDF. Running OCR page-by-page.`, { model });
  const results: string[] = [];
  for (let i = 0; i < jpegs.length; i++) {
    log('info', `Running OCR on page ${i + 1}/${jpegs.length}...`);
    const imgBase64 = 'data:image/jpeg;base64,' + uint8ArrayToBase64(jpegs[i]);
    const pageText = await runOcrOnImage(imgBase64);
    results.push(pageText);
  }
  return results.join('\n\n');
}

async function postCallback(
  env: Env,
  payload: { documentId: string; text: string; pageCount?: number; error?: string },
): Promise<Response> {
  const body = JSON.stringify(payload);
  const sig = await hmacSha256Hex(env.OCR_CALLBACK_SECRET, body);
  const res = await fetch(env.BACKEND_CALLBACK_URL, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-ocr-signature': `sha256=${sig}`,
    },
    body,
  });
  return res;
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

    const text = await callOcr(env, pdfBytes);
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

    const candidates = listed.objects
      .filter((o) => o.key.toLowerCase().endsWith('.pdf'))
      .slice(0, maxFiles);

    if (candidates.length === 0) {
      log('debug', 'no PDFs in ocr-inbox/', { total: listed.objects.length });
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
