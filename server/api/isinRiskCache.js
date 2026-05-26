/**
 * Load and persist the shared on-disk ISIN risk cache used across all users.
 */
const fs = require('fs');
const path = require('path');

const { USERS_DIR } = require('../auth');
const scraperCore = require('../scrapers/core');
const { buildIsinRiskCacheKey } = require('../scrapers/vendors/justETFscraper');

const DATA_DIR = path.dirname(USERS_DIR);
const ISIN_RISK_CACHE_PATH = path.join(DATA_DIR, 'isinRiskCache.json');

let persistedCache = null;

/**
 * Normalize a candidate ISIN into the shared uppercase representation.
 * @param {string} isin - Candidate ISIN.
 * @returns {string}
 */
const normalizeIsin = (isin) => String(isin || '').trim().toUpperCase();

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
 * Ensure the shared cache file exists on disk.
 * @returns {void}
 */
const ensureIsinRiskCacheFile = () => {
  fs.mkdirSync(DATA_DIR, { recursive: true });

  if (!fs.existsSync(ISIN_RISK_CACHE_PATH)) {
    fs.writeFileSync(ISIN_RISK_CACHE_PATH, '{}\n', 'utf8');
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

  if (!Number.isInteger(numericValue) || numericValue < 1 || numericValue > 7 || !updatedAt) {
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

  return Object.entries(payload).reduce((acc, [isin, entry]) => {
    const normalizedIsin = normalizeIsin(isin);
    const normalizedEntry = normalizePersistedEntry(entry);

    if (normalizedIsin && normalizedEntry) {
      acc[normalizedIsin] = normalizedEntry;
    }

    return acc;
  }, {});
};

/**
 * Build a stable cache object with alphabetically sorted ISIN keys.
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
const loadPersistedIsinRiskCache = () => {
  if (persistedCache) {
    return persistedCache;
  }

  ensureIsinRiskCacheFile();

  try {
    const raw = fs.readFileSync(ISIN_RISK_CACHE_PATH, 'utf8');
    persistedCache = normalizePersistedCache(JSON.parse(raw));
  } catch (error) {
    console.error(`Failed to read shared ISIN risk cache: ${error.message}`);
    persistedCache = {};
  }

  return persistedCache;
};

/**
 * Rewrite the shared on-disk cache atomically.
 * @returns {void}
 */
const writePersistedIsinRiskCache = () => {
  ensureIsinRiskCacheFile();
  const nextCache = sortPersistedCache(loadPersistedIsinRiskCache());
  const tempPath = `${ISIN_RISK_CACHE_PATH}.${process.pid}.${Date.now()}.tmp`;
  fs.writeFileSync(tempPath, `${JSON.stringify(nextCache, null, 2)}\n`, 'utf8');
  fs.renameSync(tempPath, ISIN_RISK_CACHE_PATH);
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
 * Seed the shared scraper runtime with the persisted ISIN risk values.
 * @returns {number}
 */
const loadPersistedIsinRiskCacheIntoRuntime = () => {
  const cache = loadPersistedIsinRiskCache();
  const runtimeEntries = Object.entries(cache).reduce((acc, [isin, entry]) => {
    acc[buildIsinRiskCacheKey(isin)] = { ...entry };
    return acc;
  }, {});

  return scraperCore.hydrateCacheEntries(runtimeEntries);
};

/**
 * Persist the runtime cache entries for the requested ISINs back to disk.
 * @param {string[]} isins - ISINs to sync from the in-memory scraper cache.
 * @returns {boolean}
 */
const persistIsinRiskEntries = (isins) => {
  const normalizedIsins = [...new Set(
    (Array.isArray(isins) ? isins : [])
      .map(normalizeIsin)
      .filter(Boolean)
  )];

  if (!normalizedIsins.length) {
    return false;
  }

  const cache = loadPersistedIsinRiskCache();
  const cacheKeys = normalizedIsins.map(buildIsinRiskCacheKey);
  const runtimeEntries = scraperCore.getCacheEntriesSnapshot(cacheKeys);
  let didChange = false;

  for (const isin of normalizedIsins) {
    const runtimeEntry = runtimeEntries[buildIsinRiskCacheKey(isin)];
    if (!runtimeEntry) {
      continue;
    }

    const nextEntry = {
      value: runtimeEntry.value,
      updatedAt: runtimeEntry.updatedAt,
      provider: runtimeEntry.provider || null,
      sourceUrl: runtimeEntry.sourceUrl || null,
    };

    if (isSamePersistedEntry(cache[isin], nextEntry)) {
      continue;
    }

    cache[isin] = nextEntry;
    didChange = true;
  }

  if (didChange) {
    writePersistedIsinRiskCache();
  }

  return didChange;
};

module.exports = {
  ISIN_RISK_CACHE_PATH,
  loadPersistedIsinRiskCache,
  loadPersistedIsinRiskCacheIntoRuntime,
  persistIsinRiskEntries,
};
