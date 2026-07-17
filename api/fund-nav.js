const REQUEST_TIMEOUT_MS = 12000;
const MAX_ATTEMPTS = 3;

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.end(JSON.stringify(payload));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeSymbol(value) {
  return String(value || "").trim().toUpperCase();
}

function isSafeSymbol(symbol) {
  return (
    symbol.length > 0 &&
    symbol.length <= 80 &&
    /^[A-Z0-9().+\-_/]+$/.test(symbol)
  );
}

function getNavNumber(item) {
  const candidates = [
    item?.nav,
    item?.NAV,
    item?.navPerUnit,
    item?.nav_per_unit,
    item?.value
  ];

  for (const candidate of candidates) {
    const value = Number(candidate);

    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }

  return null;
}

function getNavDate(item) {
  const candidates = [
    item?.date,
    item?.navDate,
    item?.nav_date,
    item?.asOfDate,
    item?.updatedAt
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return null;
}

function extractRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.result)) return payload.result;
  if (Array.isArray(payload?.navs)) return payload.navs;

  return [];
}

async function fetchFinnomena(symbol) {
  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    REQUEST_TIMEOUT_MS
  );

  try {
    const url =
      "https://api.finnomena.com/fund/api/v1/fund/detail/NAV" +
      `?symbol=${encodeURIComponent(symbol)}`;

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "SmartInvestAI/1.0"
      },
      signal: controller.signal
    });

    const text = await response.text();

    if (!response.ok) {
      return {
        ok: false,
        status: response.status,
        error: text.slice(0, 500)
      };
    }

    let payload;

    try {
      payload = JSON.parse(text);
    } catch {
      return {
        ok: false,
        status: 502,
        error: "Finnomena returned invalid JSON."
      };
    }

    const rows = extractRows(payload)
      .map((item) => ({
        nav: getNavNumber(item),
        date: getNavDate(item)
      }))
      .filter((row) => row.nav !== null);

    if (rows.length === 0) {
      return {
        ok: false,
        status: 404,
        error: `No NAV data found for ${symbol}.`
      };
    }

    const latest = rows.at(-1);
    const previous =
      rows.length > 1 ? rows.at(-2) : latest;

    return {
      ok: true,
      status: 200,
      data: {
        symbol,
        price: latest.nav,
        prevClose: previous.nav,
        navDate: latest.date,
        previousNavDate: previous.date,
        source: "Finnomena"
      }
    };
  } catch (error) {
    const timedOut =
      error instanceof Error &&
      error.name === "AbortError";

    return {
      ok: false,
      status: timedOut ? 504 : 502,
      error: timedOut
        ? "Finnomena request timed out."
        : "Finnomena request failed."
    };
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");

    return sendJson(res, 405, {
      error: "Method not allowed"
    });
  }

  const symbol = normalizeSymbol(req.query?.symbol);

  if (!isSafeSymbol(symbol)) {
    return sendJson(res, 400, {
      error: "Invalid symbol",
      message: "A valid mutual-fund symbol is required."
    });
  }

  let lastResult = null;

  for (
    let attempt = 0;
    attempt < MAX_ATTEMPTS;
    attempt += 1
  ) {
    const result = await fetchFinnomena(symbol);
    lastResult = result;

    if (result.ok) {
      res.setHeader("X-Price-Source", "Finnomena");
      return sendJson(res, 200, result.data);
    }

    const retryable =
      result.status === 408 ||
      result.status === 429 ||
      result.status === 502 ||
      result.status === 503 ||
      result.status === 504 ||
      result.status >= 520;

    if (
      !retryable ||
      attempt === MAX_ATTEMPTS - 1
    ) {
      break;
    }

    const delay =
      500 * 2 ** attempt +
      Math.floor(Math.random() * 250);

    await sleep(delay);
  }

  return sendJson(
    res,
    lastResult?.status || 502,
    {
      error: "Unable to retrieve fund NAV",
      symbol,
      message:
        lastResult?.error ||
        "Unknown upstream error"
    }
  );
}
