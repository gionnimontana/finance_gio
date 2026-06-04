/**
 * Load and persist the shared on-disk ISIN risk cache used across all users.
 */
const { buildIsinRiskCacheKey, normalizeIsin } = require('../scrapers/vendors/justETFscraper')
const { createSharedRiskCache } = require('./sharedRiskCache')

const isinRiskCache = createSharedRiskCache({
	cacheFileName: 'isinRiskCache.json',
	normalizeKey: normalizeIsin,
	buildRuntimeCacheKey: buildIsinRiskCacheKey,
})

module.exports = {
	ISIN_RISK_CACHE_PATH: isinRiskCache.cachePath,
	loadPersistedIsinRiskCache: isinRiskCache.loadPersistedCache,
	loadPersistedIsinRiskCacheIntoRuntime: isinRiskCache.loadPersistedCacheIntoRuntime,
	persistIsinRiskEntries: isinRiskCache.persistEntries,
}
