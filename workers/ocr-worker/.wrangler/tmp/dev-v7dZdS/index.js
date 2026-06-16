var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// .wrangler/tmp/bundle-4xytS2/strip-cf-connecting-ip-header.js
function stripCfConnectingIPHeader(input, init) {
  const request = new Request(input, init);
  request.headers.delete("CF-Connecting-IP");
  return request;
}
__name(stripCfConnectingIPHeader, "stripCfConnectingIPHeader");
globalThis.fetch = new Proxy(globalThis.fetch, {
  apply(target, thisArg, argArray) {
    return Reflect.apply(target, thisArg, [
      stripCfConnectingIPHeader.apply(null, argArray)
    ]);
  }
});

// src/index.ts
var OCR_PROMPT_VI = [
  "B\u1EA1n l\xE0 m\u1ED9t h\u1EC7 th\u1ED1ng OCR chuy\xEAn tr\xEDch xu\u1EA5t v\u0103n b\u1EA3n t\u1EEB t\xE0i li\u1EC7u PDF ti\u1EBFng Vi\u1EC7t.",
  "Nhi\u1EC7m v\u1EE5: tr\xEDch xu\u1EA5t TO\xC0N B\u1ED8 v\u0103n b\u1EA3n c\xF3 trong t\xE0i li\u1EC7u PDF \u0111\u01B0\u1EE3c cung c\u1EA5p, gi\u1EEF nguy\xEAn th\u1EE9 t\u1EF1 v\xE0 c\u1EA5u tr\xFAc \u0111o\u1EA1n v\u0103n.",
  "Y\xEAu c\u1EA7u:",
  "- Gi\u1EEF nguy\xEAn d\u1EA5u thanh ti\u1EBFng Vi\u1EC7t \u0111\u1EA7y \u0111\u1EE7.",
  "- Gi\u1EEF nguy\xEAn s\u1ED1 \u0111i\u1EC1u, s\u1ED1 kho\u1EA3n, d\u1EA5u g\u1EA1ch \u0111\u1EA7u d\xF2ng, ti\xEAu \u0111\u1EC1 \u0111\u1EC1 m\u1EE5c.",
  "- Ph\xE2n t\xE1ch c\xE1c trang b\u1EB1ng m\u1ED9t d\xF2ng tr\u1ED1ng.",
  "- Ch\u1EC9 tr\u1EA3 v\u1EC1 v\u0103n b\u1EA3n thu\u1EA7n t\xFAy. KH\xD4NG th\xEAm l\u1EDDi d\u1EABn, KH\xD4NG th\xEAm gi\u1EA3i th\xEDch, KH\xD4NG d\xF9ng markdown."
].join("\n");
var KV_TTL_SECONDS = 60 * 60 * 24 * 7;
function log(level, msg, extra) {
  const payload = { level, msg, time: (/* @__PURE__ */ new Date()).toISOString() };
  if (extra)
    Object.assign(payload, extra);
  console.log(JSON.stringify(payload));
}
__name(log, "log");
function arrayBufferToBase64(buf) {
  const bytes = new Uint8Array(buf);
  let binary = "";
  const chunk = 32768;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunk))
    );
  }
  return btoa(binary);
}
__name(arrayBufferToBase64, "arrayBufferToBase64");
async function hmacSha256Hex(secret, data) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
__name(hmacSha256Hex, "hmacSha256Hex");
function documentIdFromKey(key) {
  const m = key.match(/^ocr-inbox\/([0-9a-fA-F-]{36})\.pdf$/i);
  return m ? m[1] : null;
}
__name(documentIdFromKey, "documentIdFromKey");
async function callOcr(env, pdfBase64) {
  const model = env.OCR_MODEL || "@cf/meta/llama-3.2-11b-vision-instruct";
  const response = await env.AI.run(model, {
    image: [pdfBase64],
    prompt: OCR_PROMPT_VI,
    max_tokens: 4096
  });
  let text;
  if (typeof response === "string") {
    text = response;
  } else if (response && typeof response === "object") {
    text = response.description ?? response.response ?? response.text;
  }
  if (!text) {
    throw new Error("AI returned empty response");
  }
  return text.trim();
}
__name(callOcr, "callOcr");
async function postCallback(env, payload) {
  const body = JSON.stringify(payload);
  const sig = await hmacSha256Hex(env.OCR_CALLBACK_SECRET, body);
  const res = await fetch(env.BACKEND_CALLBACK_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-ocr-signature": `sha256=${sig}`
    },
    body
  });
  return res;
}
__name(postCallback, "postCallback");
async function processObject(env, key, size) {
  const documentId = documentIdFromKey(key);
  if (!documentId) {
    log("warn", "cannot derive documentId from key", { key });
    await env.OCR_STATE.put(`seen:${key}`, "1", { expirationTtl: KV_TTL_SECONDS });
    return;
  }
  log("info", "processing PDF", { documentId, key, size });
  try {
    const obj = await env.R2.get(key);
    if (!obj) {
      throw new Error(`R2 object not found: ${key}`);
    }
    const buf = await obj.arrayBuffer();
    const base64 = arrayBufferToBase64(buf);
    const text = await callOcr(env, base64);
    if (!text) {
      throw new Error("OCR returned empty text");
    }
    const res = await postCallback(env, { documentId, text });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Callback ${res.status}: ${body.slice(0, 500)}`);
    }
    log("info", "OCR completed and delivered", {
      documentId,
      bytes: text.length,
      status: res.status
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    log("error", "OCR failed", { documentId, error: msg });
    throw e;
  }
  await env.OCR_STATE.put(`seen:${key}`, "1", { expirationTtl: KV_TTL_SECONDS });
}
__name(processObject, "processObject");
var src_default = {
  /**
   * Cron trigger — runs on the schedule declared in wrangler.toml.
   * Lists the R2 prefix, filters for unprocessed PDFs, and OCRs them
   * up to MAX_FILES_PER_TICK.
   */
  async scheduled(event, env, ctx) {
    log("info", "cron tick", {
      cron: event.cron,
      scheduledTime: new Date(event.scheduledTime).toISOString()
    });
    const maxFiles = parseInt(env.MAX_FILES_PER_TICK || "10", 10);
    let listed;
    try {
      listed = await env.R2.list({ prefix: "ocr-inbox/" });
    } catch (e) {
      log("error", "R2 list failed", { error: e instanceof Error ? e.message : String(e) });
      return;
    }
    const candidates = listed.objects.filter((o) => o.key.toLowerCase().endsWith(".pdf")).slice(0, maxFiles);
    if (candidates.length === 0) {
      log("debug", "no PDFs in ocr-inbox/", { total: listed.objects.length });
      return;
    }
    let processed = 0;
    let skipped = 0;
    let failed = 0;
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
        failed++;
      }
    }
    log("info", "cron tick done", { processed, skipped, failed, total: candidates.length });
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
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname !== "/process") {
      return new Response("not found", { status: 404 });
    }
    if (req.method !== "POST") {
      return new Response("POST only", { status: 405 });
    }
    const body = await req.json();
    if (!body.key) {
      return new Response("missing key", { status: 400 });
    }
    try {
      await processObject(env, body.key, 0);
      return new Response("ok", { status: 200 });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      return new Response(`error: ${msg}`, { status: 500 });
    }
  }
};

// ../../node_modules/.pnpm/wrangler@3.114.17_@cloudflare+workers-types@4.20260616.1/node_modules/wrangler/templates/middleware/middleware-ensure-req-body-drained.ts
var drainBody = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } finally {
    try {
      if (request.body !== null && !request.bodyUsed) {
        const reader = request.body.getReader();
        while (!(await reader.read()).done) {
        }
      }
    } catch (e) {
      console.error("Failed to drain the unused request body.", e);
    }
  }
}, "drainBody");
var middleware_ensure_req_body_drained_default = drainBody;

// ../../node_modules/.pnpm/wrangler@3.114.17_@cloudflare+workers-types@4.20260616.1/node_modules/wrangler/templates/middleware/middleware-miniflare3-json-error.ts
function reduceError(e) {
  return {
    name: e?.name,
    message: e?.message ?? String(e),
    stack: e?.stack,
    cause: e?.cause === void 0 ? void 0 : reduceError(e.cause)
  };
}
__name(reduceError, "reduceError");
var jsonError = /* @__PURE__ */ __name(async (request, env, _ctx, middlewareCtx) => {
  try {
    return await middlewareCtx.next(request, env);
  } catch (e) {
    const error = reduceError(e);
    return Response.json(error, {
      status: 500,
      headers: { "MF-Experimental-Error-Stack": "true" }
    });
  }
}, "jsonError");
var middleware_miniflare3_json_error_default = jsonError;

// .wrangler/tmp/bundle-4xytS2/middleware-insertion-facade.js
var __INTERNAL_WRANGLER_MIDDLEWARE__ = [
  middleware_ensure_req_body_drained_default,
  middleware_miniflare3_json_error_default
];
var middleware_insertion_facade_default = src_default;

// ../../node_modules/.pnpm/wrangler@3.114.17_@cloudflare+workers-types@4.20260616.1/node_modules/wrangler/templates/middleware/common.ts
var __facade_middleware__ = [];
function __facade_register__(...args) {
  __facade_middleware__.push(...args.flat());
}
__name(__facade_register__, "__facade_register__");
function __facade_invokeChain__(request, env, ctx, dispatch, middlewareChain) {
  const [head, ...tail] = middlewareChain;
  const middlewareCtx = {
    dispatch,
    next(newRequest, newEnv) {
      return __facade_invokeChain__(newRequest, newEnv, ctx, dispatch, tail);
    }
  };
  return head(request, env, ctx, middlewareCtx);
}
__name(__facade_invokeChain__, "__facade_invokeChain__");
function __facade_invoke__(request, env, ctx, dispatch, finalMiddleware) {
  return __facade_invokeChain__(request, env, ctx, dispatch, [
    ...__facade_middleware__,
    finalMiddleware
  ]);
}
__name(__facade_invoke__, "__facade_invoke__");

// .wrangler/tmp/bundle-4xytS2/middleware-loader.entry.ts
var __Facade_ScheduledController__ = class {
  constructor(scheduledTime, cron, noRetry) {
    this.scheduledTime = scheduledTime;
    this.cron = cron;
    this.#noRetry = noRetry;
  }
  #noRetry;
  noRetry() {
    if (!(this instanceof __Facade_ScheduledController__)) {
      throw new TypeError("Illegal invocation");
    }
    this.#noRetry();
  }
};
__name(__Facade_ScheduledController__, "__Facade_ScheduledController__");
function wrapExportedHandler(worker) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return worker;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  const fetchDispatcher = /* @__PURE__ */ __name(function(request, env, ctx) {
    if (worker.fetch === void 0) {
      throw new Error("Handler does not export a fetch() function.");
    }
    return worker.fetch(request, env, ctx);
  }, "fetchDispatcher");
  return {
    ...worker,
    fetch(request, env, ctx) {
      const dispatcher = /* @__PURE__ */ __name(function(type, init) {
        if (type === "scheduled" && worker.scheduled !== void 0) {
          const controller = new __Facade_ScheduledController__(
            Date.now(),
            init.cron ?? "",
            () => {
            }
          );
          return worker.scheduled(controller, env, ctx);
        }
      }, "dispatcher");
      return __facade_invoke__(request, env, ctx, dispatcher, fetchDispatcher);
    }
  };
}
__name(wrapExportedHandler, "wrapExportedHandler");
function wrapWorkerEntrypoint(klass) {
  if (__INTERNAL_WRANGLER_MIDDLEWARE__ === void 0 || __INTERNAL_WRANGLER_MIDDLEWARE__.length === 0) {
    return klass;
  }
  for (const middleware of __INTERNAL_WRANGLER_MIDDLEWARE__) {
    __facade_register__(middleware);
  }
  return class extends klass {
    #fetchDispatcher = (request, env, ctx) => {
      this.env = env;
      this.ctx = ctx;
      if (super.fetch === void 0) {
        throw new Error("Entrypoint class does not define a fetch() function.");
      }
      return super.fetch(request);
    };
    #dispatcher = (type, init) => {
      if (type === "scheduled" && super.scheduled !== void 0) {
        const controller = new __Facade_ScheduledController__(
          Date.now(),
          init.cron ?? "",
          () => {
          }
        );
        return super.scheduled(controller);
      }
    };
    fetch(request) {
      return __facade_invoke__(
        request,
        this.env,
        this.ctx,
        this.#dispatcher,
        this.#fetchDispatcher
      );
    }
  };
}
__name(wrapWorkerEntrypoint, "wrapWorkerEntrypoint");
var WRAPPED_ENTRY;
if (typeof middleware_insertion_facade_default === "object") {
  WRAPPED_ENTRY = wrapExportedHandler(middleware_insertion_facade_default);
} else if (typeof middleware_insertion_facade_default === "function") {
  WRAPPED_ENTRY = wrapWorkerEntrypoint(middleware_insertion_facade_default);
}
var middleware_loader_entry_default = WRAPPED_ENTRY;
export {
  __INTERNAL_WRANGLER_MIDDLEWARE__,
  middleware_loader_entry_default as default
};
//# sourceMappingURL=index.js.map
