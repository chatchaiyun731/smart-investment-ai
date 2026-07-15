// src/cacheManager.js
// Simple file‑based cache for context data (market API results, portfolio calculations)
// Each cache entry is stored as a JSON file under ./cache with an expiration timestamp.
// TTL (time‑to‑live) can be specified per entry; default is 30 minutes.

import { promises as fs } from "fs";
import path from "path";

const CACHE_DIR = path.resolve(process.cwd(), "cache");

/** Ensure the cache directory exists */
async function ensureCacheDir() {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
  } catch (e) {
    // ignore if it already exists
  }
}

/** Build a file name from a cache key (URL‑safe) */
function keyToFilename(key) {
  // simple base64 encoding to avoid illegal characters
  const safe = Buffer.from(key).toString("base64url");
  return path.join(CACHE_DIR, `${safe}.json`);
}

/** Set a value in cache
 * @param {string} key – unique identifier for the entry
 * @param {any} value – data to store (will be JSON‑stringified)
 * @param {number} [ttlMs=30*60*1000] – time‑to‑live in milliseconds
 */
export async function setCache(key, value, ttlMs = 30 * 60 * 1000) {
  await ensureCacheDir();
  const expiresAt = Date.now() + ttlMs;
  const payload = { value, expiresAt };
  const filePath = keyToFilename(key);
  await fs.writeFile(filePath, JSON.stringify(payload), "utf8");
}

/** Get a value from cache
 * @param {string} key – identifier used when storing
 * @returns {Promise<any|null>} – cached value or null if missing/expired
 */
export async function getCache(key) {
  const filePath = keyToFilename(key);
  try {
    const raw = await fs.readFile(filePath, "utf8");
    const { value, expiresAt } = JSON.parse(raw);
    if (Date.now() > expiresAt) {
      // expired – delete file
      await fs.unlink(filePath).catch(() => {});
      return null;
    }
    return value;
  } catch (e) {
    // file does not exist or malformed
    return null;
  }
}

/** Delete a specific cache entry */
export async function deleteCache(key) {
  const filePath = keyToFilename(key);
  await fs.unlink(filePath).catch(() => {});
}

/** Clear all cache entries (useful for dev / manual refresh) */
export async function clearAllCache() {
  try {
    const files = await fs.readdir(CACHE_DIR);
    await Promise.all(
      files.map((f) => fs.unlink(path.join(CACHE_DIR, f)))
    );
  } catch (e) {
    // ignore if directory missing
  }
}

// Example usage (remove after integration)
// const marketKey = "market:prices:USD";
// const data = await getCache(marketKey);
// if (!data) {
//   const fresh = await fetchMarketPrices(); // your existing function
//   await setCache(marketKey, fresh, 5 * 60 * 1000); // 5‑minute TTL as you requested
// }
