/**
 * Load and persist the shared on-disk crypto risk cache used across all users.
 */
const { buildCryptoRiskCacheKey, normalizeCryptoTicker } = require('../scrapers/vendors/cryptoRiskScraper');
const { createSharedRiskCache } = require('./sharedRiskCache');

const cryptoRiskCache = createSharedRiskCache({
  cacheFileName: 'cryptoRiskCache.json',
  normalizeKey: normalizeCryptoTicker,
  buildRuntimeCacheKey: buildCryptoRiskCacheKey,
});

module.exports = {
  CRYPTO_RISK_CACHE_PATH: cryptoRiskCache.cachePath,
  loadPersistedCryptoRiskCache: cryptoRiskCache.loadPersistedCache,
  loadPersistedCryptoRiskCacheIntoRuntime: cryptoRiskCache.loadPersistedCacheIntoRuntime,
  persistCryptoRiskEntries: cryptoRiskCache.persistEntries,
};
