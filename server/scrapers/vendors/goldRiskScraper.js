/**
 * Resolve 1-7 physical-gold risk scores from Yahoo Finance daily history through the shared fetch-first runtime.
 */
const yahooFinance = require('./yahooFinance');
const {
  bucketRiskScore,
  calculateAnnualizedVolatility,
  calculateDailyReturns,
  calculateMaxDrawdown,
  scoreRiskFromHistory,
} = require('./marketRisk');

const GOLD_MARKET_SYMBOL = 'GC=F';
const GOLD_RISK_CACHE_KEY_PREFIX = 'gold-risk:';
const GOLD_RISK_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const GOLD_HISTORY_RANGE = '1y';
const GOLD_HISTORY_INTERVAL = '1d';
const VOLATILITY_LOOKBACK_DAYS = 90;
const MAX_DRAWDOWN_LOOKBACK_DAYS = 365;
const VOLATILITY_THRESHOLDS = [0.2, 0.35, 0.5, 0.65, 0.85, 1.05];
const MAX_DRAWDOWN_THRESHOLDS = [0.1, 0.2, 0.3, 0.45, 0.6, 0.75];

/**
 * Normalize a candidate gold asset id into a stable cache-key representation.
 * @param {string} assetId - Candidate asset id.
 * @returns {string}
 */
const normalizeGoldAssetId = (assetId) => String(assetId || '').trim().toLowerCase();

/**
 * Build the isolated cache key used for persisted gold risk scores.
 * @param {string} assetId - Requested gold asset id.
 * @returns {string}
 */
const buildGoldRiskCacheKey = (assetId) => `${GOLD_RISK_CACHE_KEY_PREFIX}${normalizeGoldAssetId(assetId)}`;

/**
 * Score a daily close history into a deterministic 1-7 gold risk value.
 * @param {number[]} closes - Positive close prices in chronological order.
 * @returns {number}
 */
const scoreGoldRiskFromHistory = (closes) => scoreRiskFromHistory(closes, {
  volatilityThresholds: VOLATILITY_THRESHOLDS,
  maxDrawdownThresholds: MAX_DRAWDOWN_THRESHOLDS,
  volatilityLookbackDays: VOLATILITY_LOOKBACK_DAYS,
  maxDrawdownLookbackDays: MAX_DRAWDOWN_LOOKBACK_DAYS,
});

/**
 * Fetch Yahoo Finance gold history and convert it into a gold risk score.
 * @param {typeof fetch} [fetchImpl=fetch] - Fetch implementation for tests.
 * @returns {Promise<number>}
 */
const fetchGoldRiskScore = async (fetchImpl = fetch) => {
  const payload = await yahooFinance.fetchYahooFinanceChartPayload(
    GOLD_MARKET_SYMBOL,
    {
      interval: GOLD_HISTORY_INTERVAL,
      range: GOLD_HISTORY_RANGE,
      quoteSuffix: '',
    },
    fetchImpl
  );
  const closes = yahooFinance.extractYahooFinanceChartCloses(payload);
  return scoreGoldRiskFromHistory(closes);
};

/**
 * Build a fetch-only provider config for a gold risk score.
 * @param {string} assetId - Requested gold asset id.
 * @returns {{ name: string, url: string, selectors: string[], fetchValue: Function, parseValue: Function, logger: Function, waitUntil: string, navigationTimeoutMs: number, selectorTimeoutMs: number, waitForSelector: boolean, blockResources: boolean }}
 */
const createGoldRiskProvider = (assetId) => {
  const normalizedAssetId = normalizeGoldAssetId(assetId);
  const url = yahooFinance.getYahooFinanceChartUrl(GOLD_MARKET_SYMBOL, {
    interval: GOLD_HISTORY_INTERVAL,
    range: GOLD_HISTORY_RANGE,
    quoteSuffix: '',
  });
  /**
   * Log scraping progress for the current gold risk lookup.
   * @param {string} msg - Message to print.
   * @returns {void}
   */
  const logger = (msg) => console.log(`goldRiskScraper - ${msg}`);

  return {
    name: 'yahoo-finance-gold-risk',
    url,
    selectors: ['body'],
    fetchValue: () => fetchGoldRiskScore(),
    parseValue: () => {
      throw new Error('Value not found');
    },
    logger,
    waitUntil: 'domcontentloaded',
    navigationTimeoutMs: 2500,
    selectorTimeoutMs: 1000,
    waitForSelector: false,
    blockResources: false,
    assetId: normalizedAssetId,
  };
};

/**
 * Create the scraping config needed to resolve a gold risk score.
 * @param {string} assetId - Gold asset identifier.
 * @returns {Object<string, { cacheTtlMs: number, providers: object[] }>}
 */
const goldRiskOptionCreator = (assetId) => {
  const normalizedAssetId = normalizeGoldAssetId(assetId);
  const cacheKey = buildGoldRiskCacheKey(normalizedAssetId);

  return {
    [cacheKey]: {
      cacheTtlMs: GOLD_RISK_CACHE_TTL_MS,
      providers: [createGoldRiskProvider(normalizedAssetId)],
    },
  };
};

module.exports = {
  buildGoldRiskCacheKey,
  bucketRiskScore,
  calculateAnnualizedVolatility,
  calculateDailyReturns,
  calculateMaxDrawdown,
  createGoldRiskProvider,
  fetchGoldRiskScore,
  goldRiskOptionCreator,
  normalizeGoldAssetId,
  scoreGoldRiskFromHistory,
};
