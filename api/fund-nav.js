const SEC_BASE_URL = "https://api.sec.or.th/v2/fund";
const REQUEST_TIMEOUT_MS = 15000;
const MAX_ATTEMPTS = 3;
const PROFILE_PAGE_SIZE = 100;
const NAV_LOOKBACK_DAYS = 21;

const projectCache = new Map();
const navCache = new Map();

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
  return symbol.length > 0 && symbol.length <= 100 && /^[A-Z0-9().+\-_/]+$/.test(symbol);
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function buildDateRange() {
  const end = new Date();
  const start = new Date(end);
  start.setUTCDate(start.getUTCDate() - NAV_LOOKBACK_DAYS);
  return { start: formatDate(start), end: formatDate(end) };
}

function extractItems(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.result)) return payload.result;
  return [];
}

function getNextCursor(payload) {
  const cursor = payload?.next_cursor ?? payload?.nextCursor;
  return typeof cursor === "string" && cursor.trim() ? cursor.trim() : null;
}

function candidateNames(item) {
  return [
    item?.fund_class_name,
    item?.class_abbr_name,
    item?.proj_abbr_name,
    item?.fund_abbr_name,
    item?.project_name,
    item?.proj_name_th,
    item?.fund_name_th,
  ]
    .filter((value) => typeof value === "string")
    .map((value) => value.trim().toUpperCase());
}

function findMatchingProject(items, symbol) {
  const exact = items.find((item) => candidateNames(item).includes(symbol));
  if (exact) return exact;
  const compact = symbol.replace(/[^A-Z0-9]/g, "");
  return items.find((item) =>
    candidateNames(item).some((name) => name.replace(/[^A-Z0-9]/g, "") === compact)
  );
}

function getProjId(item) {
  const value = item?.proj_id ?? item?.project_id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getUniqueId(item) {
  const value = item?.unique_id ?? item?.class_id;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function getFundClassName(item) {
  return candidateNames(item)[0] || null;
}

function getNavNumber(item) {
  const candidates = [
    item?.last_val,
    item?.nav,
    item?.NAV,
    item?.nav_per_unit,
    item?.navPerUnit,
    item?.buy_price,
    item?.sell_price,
  ];
  for (const candidate of candidates) {
    const value = Number(candidate);
    if (Number.isFinite(value) && value > 0) return value;
  }
  return null;
}

function getNavDate(item) {
  const candidates = [item?.nav_date, item?.date, item?.as_of_date, item?.updated_at];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
  }
  return null;
}

async function secFetch(path, query, apiKey) {
  let lastError = null;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    try {
      const url = new URL(`${SEC_BASE_URL}${path}`);
      for (const [key, value] of Object.entries(query || {})) {
        if (value !== undefined && value !== null && String(value).trim() !== "") {
          url.searchParams.set(key, String(value));
        }
      }

      const response = await fetch(url, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "Ocp-Apim-Subscription-Key": apiKey,
        },
        signal: controller.signal,
      });

      const text = await response.text();
      if (response.status === 204) return { ok: true, status: 204, payload: { items: [] } };

      let payload = null;
      if (text) {
        try { payload = JSON.parse(text); }
        catch { payload = { raw: text.slice(0, 1000) }; }
      }

      if (response.ok) return { ok: true, status: response.status, payload };

      const retryable = [408, 429, 502, 503, 504].includes(response.status) || response.status >= 520;
      lastError = {
        status: response.status,
        message: payload?.message || payload?.error || `SEC API returned HTTP ${response.status}`,
      };
      if (!retryable || attempt === MAX_ATTEMPTS - 1) break;
    } catch (error) {
      const timedOut = error instanceof Error && error.name === "AbortError";
      lastError = {
        status: timedOut ? 504 : 502,
        message: timedOut ? "SEC API request timed out" : "SEC API request failed",
      };
      if (attempt === MAX_ATTEMPTS - 1) break;
    } finally {
      clearTimeout(timeout);
    }

    await sleep(500 * 2 ** attempt + Math.floor(Math.random() * 250));
  }

  return { ok: false, status: lastError?.status || 502, payload: lastError || { message: "Unknown SEC API error" } };
}

async function searchProjectBySymbol(symbol, apiKey) {
  const cached = projectCache.get(symbol);
  if (cached) return cached;

  for (const query of [{ fund_class_name: symbol }, { project_info: symbol }]) {
    const result = await secFetch("/general-info/profiles", { page_size: PROFILE_PAGE_SIZE, ...query }, apiKey);
    if (!result.ok) continue;
    const match = findMatchingProject(extractItems(result.payload), symbol);
    if (match) {
      const project = {
        projId: getProjId(match),
        uniqueId: getUniqueId(match),
        fundClassName: getFundClassName(match),
      };
      if (project.projId) {
        projectCache.set(symbol, project);
        return project;
      }
    }
  }

  let nextCursor = null;
  for (let page = 0; page < 20; page += 1) {
    const result = await secFetch(
      "/general-info/profiles",
      { page_size: PROFILE_PAGE_SIZE, next_cursor: nextCursor },
      apiKey
    );
    if (!result.ok) break;
    const match = findMatchingProject(extractItems(result.payload), symbol);
    if (match) {
      const project = {
        projId: getProjId(match),
        uniqueId: getUniqueId(match),
        fundClassName: getFundClassName(match),
      };
      if (project.projId) {
        projectCache.set(symbol, project);
        return project;
      }
    }
    nextCursor = getNextCursor(result.payload);
    if (!nextCursor) break;
  }

  return null;
}

async function fetchLatestNav(project, symbol, apiKey) {
  const cacheKey = `${project.projId}:${project.uniqueId || ""}`;
  const cached = navCache.get(cacheKey);
  if (cached && Date.now() - cached.cachedAt < 30 * 60 * 1000) return cached.data;

  const range = buildDateRange();
  const result = await secFetch(
    "/daily-info/nav",
    {
      page_size: 100,
      proj_id: project.projId,
      start_nav_date: range.start,
      end_nav_date: range.end,
      fund_class_name: project.fundClassName || symbol,
    },
    apiKey
  );

  if (!result.ok) {
    return {
      ok: false,
      status: result.status,
      message: result.payload?.message || result.payload?.error || "Unable to retrieve NAV from SEC",
    };
  }

  const rows = extractItems(result.payload)
    .map((item) => ({ nav: getNavNumber(item), date: getNavDate(item) }))
    .filter((row) => row.nav !== null)
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")));

  if (rows.length === 0) {
    return { ok: false, status: 404, message: `No NAV data found for ${symbol}` };
  }

  const latest = rows.at(-1);
  const previous = rows.length > 1 ? rows.at(-2) : latest;
  const data = {
    ok: true,
    status: 200,
    symbol,
    projId: project.projId,
    uniqueId: project.uniqueId,
    fundClassName: project.fundClassName || symbol,
    price: latest.nav,
    prevClose: previous.nav,
    navDate: latest.date,
    previousNavDate: previous.date,
    source: "SEC Open Data",
  };

  navCache.set(cacheKey, { cachedAt: Date.now(), data });
  return data;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return sendJson(res, 405, { error: "Method not allowed" });
  }

  const apiKey = String(process.env.SEC_API_KEY || "").trim();
  if (!apiKey) {
    return sendJson(res, 500, {
      error: "Server configuration error",
      message: "SEC_API_KEY is not configured on the server.",
    });
  }

  const symbol = normalizeSymbol(req.query?.symbol);
  if (!isSafeSymbol(symbol)) {
    return sendJson(res, 400, {
      error: "Invalid symbol",
      message: "A valid mutual-fund symbol is required.",
    });
  }

  const project = await searchProjectBySymbol(symbol, apiKey);
  if (!project) {
    return sendJson(res, 404, {
      error: "Fund project not found",
      symbol,
      message: "The SEC API could not map this fund symbol to a proj_id automatically.",
    });
  }

  const navResult = await fetchLatestNav(project, symbol, apiKey);
  if (!navResult.ok) {
    return sendJson(res, navResult.status || 502, {
      error: "Unable to retrieve fund NAV",
      symbol,
      projId: project.projId,
      message: navResult.message,
    });
  }

  res.setHeader("X-Price-Source", "SEC Open Data");
  return sendJson(res, 200, navResult);
}

