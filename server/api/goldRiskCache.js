/**
 * Load and persist the shared on-disk gold risk cache used across all users.
 */
const { buildGoldRiskCacheKey, normalizeGoldAssetId } = require('../scrapers/vendors/goldRiskScraper');
const { createSharedRiskCache } = require('./sharedRiskCache');

const goldRiskCache = createSharedRiskCache({
  cacheFileName: 'goldRiskCache.json',
  normalizeKey: normalizeGoldAssetId,
  buildRuntimeCacheKey: buildGoldRiskCacheKey,
});

module.exports = {
  GOLD_RISK_CACHE_PATH: goldRiskCache.cachePath,
  loadPersistedGoldRiskCache: goldRiskCache.loadPersistedCache,
  loadPersistedGoldRiskCacheIntoRuntime: goldRiskCache.loadPersistedCacheIntoRuntime,
  persistGoldRiskEntries: goldRiskCache.persistEntries,
};
