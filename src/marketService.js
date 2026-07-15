// src/marketService.js
// Example service that fetches market price data with file‑based caching.

import fetch from "node-fetch"; // ensure node-fetch is installed (npm i node-fetch)
import { getCache, setCache } from "./cacheManager.js";

// Helper to build a cache key for a given symbol
function priceCacheKey(symbol) {
  return `market:price:${symbol.toUpperCase()}`;
}

/**
 * Fetch the latest price for a stock/crypto symbol.
 * Uses cache first; if missing or expired, falls back to the external API.
 * @param {string} symbol - e.g. "AAPL" or "BTC"
 * @param {number} [ttlMs=5*60*1000] - cache TTL (default 5 min)
 * @returns {Promise<number>} - latest price
 */
export async function fetchPrice(symbol, ttlMs = 5 * 60 * 1000) {
  const key = priceCacheKey(symbol);
  // Try cached value first
  const cached = await getCache(key);
  if (cached !== null) {
    console.log(`[cache] hit for ${symbol}`);
    return cached;
  }

  // No cached data – call external API (example: free price endpoint)
  console.log(`[api] fetching price for ${symbol}`);
  const response = await fetch(
    `https://api.example.com/price?symbol=${encodeURIComponent(symbol)}`
  );
  if (!response.ok) {
    throw new Error(`Failed to fetch price for ${symbol}: ${response.status}`);
  }
  const data = await response.json();
  const price = data.price; // adjust based on actual response shape

  // Store in cache for future calls
  await setCache(key, price, ttlMs);
  return price;
}

// Example usage (remove or comment out in production)
// (async () => {
//   const price = await fetchPrice("AAPL");
//   console.log(`AAPL price = $${price}`);
// })();
