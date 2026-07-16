const ALLOWED_MODELS = new Set([
  "gemini-2.5-flash",
  "gemini-2.5-pro",
  "gemini-2.0-flash",
  "gemini-3.5-flash",
]);

const MAX_BODY_BYTES = 1_000_000;

function json(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(payload));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return json(res, 405, { error: "Method not allowed" });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return json(res, 500, {
      error: "Server configuration error",
      message: "GEMINI_API_KEY is not configured on the server.",
    });
  }

  const contentLength = Number(req.headers["content-length"] || 0);
  if (contentLength > MAX_BODY_BYTES) {
    return json(res, 413, { error: "Request body is too large" });
  }

  const requestedModel = String(
    req.headers["x-gemini-model"] ||
    process.env.GEMINI_MODEL ||
    "gemini-2.5-flash"
  ).trim();

  const model = ALLOWED_MODELS.has(requestedModel)
    ? requestedModel
    : "gemini-2.5-flash";

  const body = req.body;
  if (!body || typeof body !== "object" || !Array.isArray(body.contents)) {
    return json(res, 400, {
      error: "Invalid request",
      message: "A Gemini-compatible contents array is required.",
    });
  }

  // Only forward fields used by this app. This prevents callers from
  // smuggling unexpected API options through the proxy.
  const upstreamBody = {
    contents: body.contents,
  };

  if (body.systemInstruction) upstreamBody.systemInstruction = body.systemInstruction;
  if (Array.isArray(body.tools)) upstreamBody.tools = body.tools;
  if (body.generationConfig) upstreamBody.generationConfig = body.generationConfig;
  if (Array.isArray(body.safetySettings)) upstreamBody.safetySettings = body.safetySettings;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 55_000);

  try {
    const upstream = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(upstreamBody),
        signal: controller.signal,
      }
    );

    const raw = await upstream.text();
    res.statusCode = upstream.status;
    res.setHeader(
      "Content-Type",
      upstream.headers.get("content-type") || "application/json; charset=utf-8"
    );
    res.setHeader("Cache-Control", "no-store");
    return res.end(raw);
  } catch (error) {
    const timedOut = error && error.name === "AbortError";
    return json(res, timedOut ? 504 : 502, {
      error: timedOut ? "Gemini request timed out" : "Gemini upstream request failed",
    });
  } finally {
    clearTimeout(timeout);
  }
}
