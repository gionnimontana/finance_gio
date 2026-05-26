/**
 * Resolve persisted and live risk indicators for asset classes that expose a 1-7 badge.
 */
const api = require('../api');
const scrapers = require('../scrapers');
const { persistIsinRiskEntries } = require('../api/isinRiskCache');
const { persistCryptoRiskEntries } = require('../api/cryptoRiskCache');
const { persistGoldRiskEntries } = require('../api/goldRiskCache');

const RISK_SCRAPER_MAX_RETRIES = 1;
const OTHER_ASSET_DEFAULT_RISK = 1;

/**
 * Convert a numeric indicator map into the shared labeled response shape.
 * @param {Record<string, number>} values - Numeric indicator values keyed by asset id.
 * @param {string} label - Badge label shown in the UI.
 * @returns {Record<string, { value: number, label: string }>}
 */
const labelRiskValues = (values, label) => Object.entries(values || {}).reduce((acc, [assetId, value]) => {
  const numericValue = Number(value);
  if (Number.isFinite(numericValue)) {
    acc[assetId] = { value: numericValue, label };
  }
  return acc;
}, {});

/**
 * Strip the shared labeled shape back to the legacy numeric payload.
 * @param {Record<string, { value?: number }>} values - Shared labeled indicator map.
 * @returns {Record<string, number>}
 */
const toLegacyRiskValues = (values) => Object.entries(values || {}).reduce((acc, [assetId, indicator]) => {
  const numericValue = Number(indicator?.value);
  if (Number.isFinite(numericValue)) {
    acc[assetId] = numericValue;
  }
  return acc;
}, {});

/**
 * Merge multiple risk-indicator states into one route payload.
 * @param {...{ values?: Record<string, { value: number, label: string }>, failures?: string[] }} states - Partial indicator states.
 * @returns {{ values: Record<string, { value: number, label: string }>, failures: string[] }}
 */
const buildRiskIndicatorPayload = (...states) => {
  const failures = [];

  return states.reduce((acc, state) => {
    Object.assign(acc.values, state?.values || {});
    for (const failure of Array.isArray(state?.failures) ? state.failures : []) {
      if (!failures.includes(failure)) {
        failures.push(failure);
      }
    }
    acc.failures = failures;
    return acc;
  }, { values: {}, failures });
};

/**
 * Resolve the summary risk indicator for every ISIN asset in the current schema.
 * @param {string} passwordHash - The hashed password identifying the user.
 * @param {boolean} refresh - Whether to bypass fresh scraper cache entries.
 * @returns {Promise<{ values: Record<string, { value: number, label: string }>, failures: string[] }>}
 */
const getIsinRiskIndicators = async (passwordHash, refresh) => {
  const assetsSchema = await api.getAssetsSchema(passwordHash);
  const isinAssets = assetsSchema.assets.filter((asset) => Array.isArray(asset) && asset[0] === 'Isin' && typeof asset[1] === 'string' && asset[1].trim());

  if (!isinAssets.length) {
    return { values: {}, failures: [] };
  }

  const cacheKeyToAssetId = isinAssets.reduce((acc, asset) => {
    const assetId = asset[1];
    acc[scrapers.etfScraper.buildIsinRiskCacheKey(assetId)] = assetId;
    return acc;
  }, {});
  const requestedIsins = isinAssets.map((asset) => asset[1]);
  const scraperOptions = isinAssets.map((asset) => scrapers.etfScraper.isinRiskOptionCreator(asset[1]));
  const scraperResult = await scrapers.multipleScraper(scraperOptions, RISK_SCRAPER_MAX_RETRIES, refresh);
  persistIsinRiskEntries(requestedIsins);
  const numericValues = Object.entries(scraperResult.values).reduce((acc, [cacheKey, value]) => {
    const assetId = cacheKeyToAssetId[cacheKey];
    if (assetId) {
      acc[assetId] = value;
    }
    return acc;
  }, {});

  return {
    values: labelRiskValues(numericValues, 'SRI'),
    failures: scraperResult.failures.map((cacheKey) => cacheKeyToAssetId[cacheKey] || cacheKey),
  };
};

/**
 * Resolve the automatic risk score for every crypto asset in the current schema.
 * @param {string} passwordHash - The hashed password identifying the user.
 * @param {boolean} refresh - Whether to bypass fresh scraper cache entries.
 * @returns {Promise<{ values: Record<string, { value: number, label: string }>, failures: string[] }>}
 */
const getCryptoRiskIndicators = async (passwordHash, refresh) => {
  const assetsSchema = await api.getAssetsSchema(passwordHash);
  const cryptoAssets = assetsSchema.assets.filter((asset) => Array.isArray(asset) && asset[0] === 'Crypto' && typeof asset[1] === 'string' && asset[1].trim());

  if (!cryptoAssets.length) {
    return { values: {}, failures: [] };
  }

  const cacheKeyToAssetId = cryptoAssets.reduce((acc, asset) => {
    const assetId = asset[1];
    acc[scrapers.cryptoRiskScraper.buildCryptoRiskCacheKey(assetId)] = assetId;
    return acc;
  }, {});
  const requestedTickers = cryptoAssets.map((asset) => asset[1]);
  const scraperOptions = cryptoAssets.map((asset) => scrapers.cryptoRiskScraper.cryptoRiskOptionCreator(asset[1]));
  const scraperResult = await scrapers.multipleScraper(scraperOptions, RISK_SCRAPER_MAX_RETRIES, refresh);
  persistCryptoRiskEntries(requestedTickers);
  const numericValues = Object.entries(scraperResult.values).reduce((acc, [cacheKey, value]) => {
    const assetId = cacheKeyToAssetId[cacheKey];
    if (assetId) {
      acc[assetId] = value;
    }
    return acc;
  }, {});

  return {
    values: labelRiskValues(numericValues, 'Risk'),
    failures: scraperResult.failures.map((cacheKey) => cacheKeyToAssetId[cacheKey] || cacheKey),
  };
};

/**
 * Resolve the automatic risk score for every gold asset in the current schema.
 * @param {string} passwordHash - The hashed password identifying the user.
 * @param {boolean} refresh - Whether to bypass fresh scraper cache entries.
 * @returns {Promise<{ values: Record<string, { value: number, label: string }>, failures: string[] }>}
 */
const getGoldRiskIndicators = async (passwordHash, refresh) => {
  const assetsSchema = await api.getAssetsSchema(passwordHash);
  const goldAssets = assetsSchema.assets.filter((asset) => Array.isArray(asset) && asset[0] === 'Gold' && typeof asset[1] === 'string' && asset[1].trim());

  if (!goldAssets.length) {
    return { values: {}, failures: [] };
  }

  const cacheKeyToAssetId = goldAssets.reduce((acc, asset) => {
    const assetId = asset[1];
    acc[scrapers.goldRiskScraper.buildGoldRiskCacheKey(assetId)] = assetId;
    return acc;
  }, {});
  const requestedAssetIds = goldAssets.map((asset) => asset[1]);
  const scraperOptions = goldAssets.map((asset) => scrapers.goldRiskScraper.goldRiskOptionCreator(asset[1]));
  const scraperResult = await scrapers.multipleScraper(scraperOptions, RISK_SCRAPER_MAX_RETRIES, refresh);
  persistGoldRiskEntries(requestedAssetIds);
  const numericValues = Object.entries(scraperResult.values).reduce((acc, [cacheKey, value]) => {
    const assetId = cacheKeyToAssetId[cacheKey];
    if (assetId) {
      acc[assetId] = value;
    }
    return acc;
  }, {});

  return {
    values: labelRiskValues(numericValues, 'Risk'),
    failures: scraperResult.failures.map((cacheKey) => cacheKeyToAssetId[cacheKey] || cacheKey),
  };
};

/**
 * Resolve default and manual risk values for "Other" assets in the current schema.
 * @param {string} passwordHash - The hashed password identifying the user.
 * @returns {Promise<{ values: Record<string, { value: number, label: string }>, failures: string[] }>}
 */
const getOtherRiskIndicators = async (passwordHash) => {
  const assetsSchema = await api.getAssetsSchema(passwordHash);
  const otherAssets = Array.isArray(assetsSchema.assets)
    ? assetsSchema.assets.filter((asset) => Array.isArray(asset) && asset[0] === 'Other' && typeof asset[1] === 'string' && asset[1].trim())
    : [];

  if (!otherAssets.length) {
    return { values: {}, failures: [] };
  }

  const defaultValues = otherAssets.reduce((acc, asset) => {
    acc[asset[1]] = OTHER_ASSET_DEFAULT_RISK;
    return acc;
  }, {});
  const allowedOtherAssetIds = new Set(Object.keys(defaultValues));
  const overrideValues = Object.entries(assetsSchema.riskOverrides || {}).reduce((acc, [assetId, value]) => {
    if (!allowedOtherAssetIds.has(assetId)) return acc;
    const numericValue = Number(value);
    if (Number.isInteger(numericValue) && numericValue >= 1 && numericValue <= 7) {
      acc[assetId] = numericValue;
    }
    return acc;
  }, {});

  return {
    values: labelRiskValues({ ...defaultValues, ...overrideValues }, 'Risk'),
    failures: [],
  };
};

/**
 * Resolve all fetchable asset risk indicators for the current schema.
 * @param {string} passwordHash - The hashed password identifying the user.
 * @param {boolean} refresh - Whether to bypass fresh scraper cache entries.
 * @returns {Promise<{ values: Record<string, { value: number, label: string }>, failures: string[] }>}
 */
const getAssetRiskIndicators = async (passwordHash, refresh) => buildRiskIndicatorPayload(
  await getIsinRiskIndicators(passwordHash, refresh),
  await getCryptoRiskIndicators(passwordHash, refresh),
  await getGoldRiskIndicators(passwordHash, refresh),
  await getOtherRiskIndicators(passwordHash)
);

module.exports = {
  buildRiskIndicatorPayload,
  getAssetRiskIndicators,
  getCryptoRiskIndicators,
  getGoldRiskIndicators,
  getIsinRiskIndicators,
  getOtherRiskIndicators,
  toLegacyRiskValues,
};
