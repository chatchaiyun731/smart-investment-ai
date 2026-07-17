const ALLOWED_MODELS = new Set([
  "gemini-3.1-flash-lite",
  "gemini-3.5-flash",
]);

const DEFAULT_MODEL = "gemini-3.1-flash-lite";
const FALLBACK_MODEL = "gemini-3.5-flash";

const MAX_BODY_BYTES = 1_000_000;
const REQUEST_TIMEOUT_MS = 18_000;
const MAX_ATTEMPTS_PER_MODEL = 2;

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableStatus(status) {
  return (
    status === 408 ||
    status === 429 ||
    (status >= 500 && status <= 599)
  );
}

function getRetryDelay(attempt) {
  // ครั้งแรกประมาณ 1–1.4 วินาที ครั้งที่สองประมาณ 2–2.4 วินาที
  const exponentialDelay = 1_000 * Math.pow(2, attempt);
  const jitter = Math.floor(Math.random() * 400);

  return exponentialDelay + jitter;
}

async function callGemini({
  model,
  apiKey,
  upstreamBody,
}) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    const url =
      `https://generativelanguage.googleapis.com/v1beta/models/` +
      `${encodeURIComponent(model)}:generateContent` +
      `?key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(upstreamBody),
      signal: controller.signal,
    });

    const raw = await response.text();

    return {
      ok: response.ok,
      status: response.status,
      raw,
      contentType:
        response.headers.get("content-type") ||
        "application/json; charset=utf-8",
      timedOut: false,
      networkError: false,
    };
  } catch (error) {
    const timedOut =
      error instanceof Error && error.name === "AbortError";

    return {
      ok: false,
      status: timedOut ? 504 : 502,
      raw: JSON.stringify({
        error: timedOut
          ? "Gemini request timed out"
          : "Gemini upstream request failed",
      }),
      contentType: "application/json; charset=utf-8",
      timedOut,
      networkError: !timedOut,
    };
  } finally {
    clearTimeout(timeout);
  }
}

async function callModelWithRetry({
  model,
  apiKey,
  upstreamBody,
}) {
  let lastResult = null;

  for (
    let attempt = 0;
    attempt < MAX_ATTEMPTS_PER_MODEL;
    attempt += 1
  ) {
    const result = await callGemini({
      model,
      apiKey,
      upstreamBody,
    });

    lastResult = result;

    if (result.ok) {
      return result;
    }

    /*
     * 400, 401 และ 403 มักเป็นปัญหาคำขอหรือสิทธิ์
     * จึงไม่ควร Retry
     */
    if (!isRetryableStatus(result.status)) {
      return result;
    }

    const isLastAttempt =
      attempt === MAX_ATTEMPTS_PER_MODEL - 1;

    if (!isLastAttempt) {
      await sleep(getRetryDelay(attempt));
    }
  }

  return lastResult;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");

    return json(res, 405, {
      error: "Method not allowed",
    });
  }

  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return json(res, 500, {
      error: "Server configuration error",
      message:
        "GEMINI_API_KEY is not configured on the server.",
    });
  }

  const contentLength = Number(
    req.headers["content-length"] || 0
  );

  if (contentLength > MAX_BODY_BYTES) {
    return json(res, 413, {
      error: "Request body is too large",
    });
  }

  const requestedModel = String(
    req.headers["x-gemini-model"] ||
      process.env.GEMINI_MODEL ||
      DEFAULT_MODEL
  ).trim();

  const primaryModel = ALLOWED_MODELS.has(requestedModel)
    ? requestedModel
    : DEFAULT_MODEL;

  const fallbackModel =
    primaryModel === FALLBACK_MODEL
      ? DEFAULT_MODEL
      : FALLBACK_MODEL;

  const body = req.body;

  if (
    !body ||
    typeof body !== "object" ||
    !Array.isArray(body.contents)
  ) {
    return json(res, 400, {
      error: "Invalid request",
      message:
        "A Gemini-compatible contents array is required.",
    });
  }

  /*
   * Forward เฉพาะฟิลด์ที่ระบบอนุญาต
   * เพื่อไม่ให้ผู้เรียกส่ง option อื่นผ่าน Proxy โดยพลการ
   */
  const upstreamBody = {
    contents: body.contents,
  };

  if (body.systemInstruction) {
    upstreamBody.systemInstruction =
      body.systemInstruction;
  }

  if (Array.isArray(body.tools)) {
    upstreamBody.tools = body.tools;
  }

  if (body.generationConfig) {
    upstreamBody.generationConfig =
      body.generationConfig;
  }

  if (Array.isArray(body.safetySettings)) {
    upstreamBody.safetySettings =
      body.safetySettings;
  }

  try {
    /*
     * ขั้นที่ 1:
     * ทดลองโมเดลที่ผู้ใช้เลือก พร้อม Retry
     */
    let result = await callModelWithRetry({
      model: primaryModel,
      apiKey,
      upstreamBody,
    });

    let modelUsed = primaryModel;
    let fallbackUsed = false;

    /*
     * ขั้นที่ 2:
     * หากยังเป็น Error ชั่วคราว ให้เปลี่ยนโมเดล
     */
    if (
      !result.ok &&
      isRetryableStatus(result.status) &&
      fallbackModel !== primaryModel
    ) {
      await sleep(getRetryDelay(1));

      result = await callModelWithRetry({
        model: fallbackModel,
        apiKey,
        upstreamBody,
      });

      modelUsed = fallbackModel;
      fallbackUsed = true;
    }

    res.statusCode = result.status;
    res.setHeader(
      "Content-Type",
      result.contentType
    );
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("X-Gemini-Model-Used", modelUsed);
    res.setHeader(
      "X-Gemini-Fallback-Used",
      fallbackUsed ? "true" : "false"
    );

    return res.end(result.raw);
  } catch (error) {
    console.error("Unexpected Gemini proxy error:", error);

    return json(res, 500, {
      error: "Unexpected server error",
      message:
        "The Gemini proxy encountered an unexpected error.",
    });
  }
}