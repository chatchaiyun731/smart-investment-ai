// src/cacheManager.js
// Simple LocalStorage-based cache for browser environment
// Expiration timestamp is stored alongside the value.
// TTL (time-to-live) can be specified per entry; default is 30 minutes.

/** Set a value in cache
 * @param {string} key – unique identifier for the entry
 * @param {any} value – data to store (will be JSON-stringified)
 * @param {number} [ttlMs=30*60*1000] – time-to-live in milliseconds
 */
export async function setCache(key, value, ttlMs = 30 * 60 * 1000) {
  try {
    const expiresAt = Date.now() + ttlMs;
    const payload = { value, expiresAt };
    localStorage.setItem(`cache:${key}`, JSON.stringify(payload));
  } catch (e) {
    console.error("Cache set failed:", e);
  }
}

/** Get a value from cache
 * @param {string} key – identifier used when storing
 * @returns {Promise<any|null>} – cached value or null if missing/expired
 */
export async function getCache(key) {
  try {
    const raw = localStorage.getItem(`cache:${key}`);
    if (!raw) return null;
    const { value, expiresAt } = JSON.parse(raw);
    if (Date.now() > expiresAt) {
      // expired – delete key
      localStorage.removeItem(`cache:${key}`);
      return null;
    }
    return value;
  } catch (e) {
    return null;
  }
}

/** Delete a specific cache entry */
export async function deleteCache(key) {
  try {
    localStorage.removeItem(`cache:${key}`);
  } catch (e) {
    console.error(e);
  }
}

/** Clear all cache entries */
export async function clearAllCache() {
  try {
    Object.keys(localStorage).forEach((k) => {
      if (k.startsWith("cache:")) {
        localStorage.removeItem(k);
      }
    });
  } catch (e) {
    console.error(e);
  }
}
