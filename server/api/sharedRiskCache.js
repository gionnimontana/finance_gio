/**
 * Create shared on-disk persistence helpers for cached risk indicator entries.
 */
const fs = require('fs');
const path = require('path');

/**
 * Normalize a positive timestamp candidate.
 * @param {unknown} value - Candidate timestamp.
 * @returns {number|null}
 */
const toPositiveTimestamp = (value) => {
  const numericValue = Number(value);
  return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null;
};

/**
 * Build a shared risk-cache store for one indicator family.
 * @param {{
 *   cacheFileName: string,
 *   normalizeKey: (key: string) => string,
 *   buildRuntimeCacheKey: (key: string) => string,
 *   isValidValue?: (value: number) => boolean
 * }} config - Store-specific behavior.
 * @returns {{
 *   cachePath: string,
 *   loadPersistedCache: () => Record<string, { value: number, updatedAt: number, provider: string|null, sourceUrl: string|null }>,
 *   loadPersistedCacheIntoRuntime: () => number,
 *   persistEntries: (keys: string[]) => boolean
 * }}
 */
const createSharedRiskCache = ({
  cacheFileName,
  normalizeKey,
  buildRuntimeCacheKey,
  isValidValue = (value) => Number.isInteger(value) && value >= 1 && value <= 7,
}) => {
  const cachePath = path.join(path.dirname(require('../auth').USERS_DIR), cacheFileName);
  let persistedCache = null;

  /**
   * Ensure the shared cache file exists on disk.
   * @returns {void}
   */
  const ensureCacheFile = () => {
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });

    if (!fs.existsSync(cachePath)) {
      fs.writeFileSync(cachePath, '{}\n', 'utf8');
    }
  };

  /**
   * Normalize one persisted cache entry from disk.
   * @param {unknown} entry - Raw JSON entry.
   * @returns {{ value: number, updatedAt: number, provider: string|null, sourceUrl: string|null } | null}
   */
  const normalizePersistedEntry = (entry) => {
    const numericValue = Number(entry?.value);
    const updatedAt = toPositiveTimestamp(entry?.updatedAt);

    if (!isValidValue(numericValue) || !updatedAt) {
      return null;
    }

    return {
      value: numericValue,
      updatedAt,
      provider: typeof entry?.provider === 'string' ? entry.provider : null,
      sourceUrl: typeof entry?.sourceUrl === 'string' ? entry.sourceUrl : null,
    };
  };

  /**
   * Normalize the raw JSON payload loaded from disk.
   * @param {unknown} payload - Parsed JSON payload.
   * @returns {Record<string, { value: number, updatedAt: number, provider: string|null, sourceUrl: string|null }>}
   */
  const normalizePersistedCache = (payload) => {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return {};
    }

    return Object.entries(payload).reduce((acc, [rawKey, entry]) => {
      const normalizedKey = normalizeKey(rawKey);
      const normalizedEntry = normalizePersistedEntry(entry);

      if (normalizedKey && normalizedEntry) {
        acc[normalizedKey] = normalizedEntry;
      }

      return acc;
    }, {});
  };

  /**
   * Build a stable cache object with alphabetically sorted keys.
   * @param {Record<string, { value: number, updatedAt: number, provider: string|null, sourceUrl: string|null }>} cache - Cache data to sort.
   * @returns {Record<string, { value: number, updatedAt: number, provider: string|null, sourceUrl: string|null }>}
   */
  const sortPersistedCache = (cache) => Object.fromEntries(
    Object.entries(cache).sort(([left], [right]) => left.localeCompare(right))
  );

  /**
   * Load the shared on-disk cache into the module-local copy.
   * @returns {Record<string, { value: number, updatedAt: number, provider: string|null, sourceUrl: string|null }>}
   */
  const loadPersistedCache = () => {
    if (persistedCache) {
      return persistedCache;
    }

    ensureCacheFile();

    try {
      const raw = fs.readFileSync(cachePath, 'utf8');
      persistedCache = normalizePersistedCache(JSON.parse(raw));
    } catch (error) {
      console.error(`Failed to read shared risk cache ${cacheFileName}: ${error.message}`);
      persistedCache = {};
    }

    return persistedCache;
  };

  /**
   * Rewrite the shared on-disk cache atomically.
   * @returns {void}
   */
  const writePersistedCache = () => {
    ensureCacheFile();
    const nextCache = sortPersistedCache(loadPersistedCache());
    const tempPath = `${cachePath}.${process.pid}.${Date.now()}.tmp`;
    fs.writeFileSync(tempPath, `${JSON.stringify(nextCache, null, 2)}\n`, 'utf8');
    fs.renameSync(tempPath, cachePath);
  };

  /**
   * Compare two normalized persisted entries.
   * @param {{ value: number, updatedAt: number, provider: string|null, sourceUrl: string|null } | undefined} left - Existing entry.
   * @param {{ value: number, updatedAt: number, provider: string|null, sourceUrl: string|null }} right - Candidate entry.
   * @returns {boolean}
   */
  const isSamePersistedEntry = (left, right) => Boolean(left)
    && left.value === right.value
    && left.updatedAt === right.updatedAt
    && left.provider === right.provider
    && left.sourceUrl === right.sourceUrl;

  /**
   * Seed the shared scraper runtime with the persisted values.
   * @returns {number}
   */
  const loadPersistedCacheIntoRuntime = () => {
    const cache = loadPersistedCache();
    const runtimeEntries = Object.entries(cache).reduce((acc, [key, entry]) => {
      acc[buildRuntimeCacheKey(key)] = { ...entry };
      return acc;
    }, {});

    return require('../scrapers/core').hydrateCacheEntries(runtimeEntries);
  };

  /**
   * Persist runtime cache entries for the requested keys back to disk.
   * @param {string[]} keys - Identifiers to sync from the in-memory scraper cache.
   * @returns {boolean}
   */
  const persistEntries = (keys) => {
    const normalizedKeys = [...new Set(
      (Array.isArray(keys) ? keys : [])
        .map(normalizeKey)
        .filter(Boolean)
    )];

    if (!normalizedKeys.length) {
      return false;
    }

    const cache = loadPersistedCache();
    const runtimeEntries = require('../scrapers/core').getCacheEntriesSnapshot(normalizedKeys.map(buildRuntimeCacheKey));
    let didChange = false;

    for (const key of normalizedKeys) {
      const runtimeEntry = runtimeEntries[buildRuntimeCacheKey(key)];
      if (!runtimeEntry) {
        continue;
      }

      const nextEntry = {
        value: runtimeEntry.value,
        updatedAt: runtimeEntry.updatedAt,
        provider: runtimeEntry.provider || null,
        sourceUrl: runtimeEntry.sourceUrl || null,
      };

      if (isSamePersistedEntry(cache[key], nextEntry)) {
        continue;
      }

      cache[key] = nextEntry;
      didChange = true;
    }

    if (didChange) {
      writePersistedCache();
    }

    return didChange;
  };

  return {
    cachePath,
    loadPersistedCache,
    loadPersistedCacheIntoRuntime,
    persistEntries,
  };
};

module.exports = {
  createSharedRiskCache,
};
