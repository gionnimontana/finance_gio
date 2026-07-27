/**
 * Resolve 1-7 crypto risk scores from Yahoo Finance daily history through the shared fetch-first runtime.
 */
const yahooFinance = require('./yahooFinance');
const {
  bucketRiskScore,
  calculateAnnualizedVolatility,
  calculateDailyReturns,
  calculateMaxDrawdown,
  scoreRiskFromHistory,
} = require('./marketRisk');

const CRYPTO_RISK_CACHE_KEY_PREFIX = 'crypto-risk:';
const CRYPTO_RISK_CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CRYPTO_HISTORY_RANGE = '1y';
const CRYPTO_HISTORY_INTERVAL = '1d';
const VOLATILITY_LOOKBACK_DAYS = 90;
const MAX_DRAWDOWN_LOOKBACK_DAYS = 365;
const VOLATILITY_THRESHOLDS = [0.2, 0.35, 0.5, 0.65, 0.85, 1.05];
const MAX_DRAWDOWN_THRESHOLDS = [0.1, 0.2, 0.3, 0.45, 0.6, 0.75];

/**
 * Normalize a candidate crypto ticker into the shared uppercase representation.
 * @param {string} ticker - Candidate ticker.
 * @returns {string}
 */
const normalizeCryptoTicker = (ticker) => String(ticker || '').trim().toUpperCase();

/**
 * Build the isolated cache key used for persisted crypto risk scores.
 * @param {string} ticker - Requested crypto ticker.
 * @returns {string}
 */
const buildCryptoRiskCacheKey = (ticker) => `${CRYPTO_RISK_CACHE_KEY_PREFIX}${normalizeCryptoTicker(ticker)}`;

/**
 * Score a daily close history into a deterministic 1-7 risk value.
 * @param {number[]} closes - Positive close prices in chronological order.
 * @returns {number}
 */
const scoreCryptoRiskFromHistory = (closes) => scoreRiskFromHistory(closes, {
  volatilityThresholds: VOLATILITY_THRESHOLDS,
  maxDrawdownThresholds: MAX_DRAWDOWN_THRESHOLDS,
  volatilityLookbackDays: VOLATILITY_LOOKBACK_DAYS,
  maxDrawdownLookbackDays: MAX_DRAWDOWN_LOOKBACK_DAYS,
});

/**
 * Fetch the Yahoo Finance daily history and convert it into a crypto risk score.
 * @param {string} ticker - Crypto ticker.
 * @param {typeof fetch} [fetchImpl=fetch] - Fetch implementation for tests.
 * @returns {Promise<number>}
 */
const fetchCryptoRiskScore = async (ticker, fetchImpl = fetch) => {
  const normalizedTicker = normalizeCryptoTicker(ticker);
  const payload = await yahooFinance.fetchYahooFinanceChartPayload(
    normalizedTicker,
    {
      interval: CRYPTO_HISTORY_INTERVAL,
      range: CRYPTO_HISTORY_RANGE,
    },
    fetchImpl
  );
  const closes = yahooFinance.extractYahooFinanceChartCloses(payload);
  return scoreCryptoRiskFromHistory(closes);
};

/**
 * Build a fetch-only provider config for a crypto risk score.
 * @param {string} ticker - Requested crypto ticker.
 * @returns {{ name: string, url: string, selectors: string[], fetchValue: Function, parseValue: Function, logger: Function, waitUntil: string, navigationTimeoutMs: number, selectorTimeoutMs: number, waitForSelector: boolean, blockResources: boolean }}
 */
const createCryptoRiskProvider = (ticker) => {
  const normalizedTicker = normalizeCryptoTicker(ticker);
  const url = yahooFinance.getYahooFinanceChartUrl(normalizedTicker, {
    interval: CRYPTO_HISTORY_INTERVAL,
    range: CRYPTO_HISTORY_RANGE,
  });
  /**
   * Log scraping progress for the current crypto risk lookup.
   * @param {string} msg - Message to print.
   * @returns {void}
   */
  const logger = (msg) => console.log(`cryptoRiskScraper - ${msg}`);

  return {
    name: 'yahoo-finance-risk',
    url,
    selectors: ['body'],
    fetchValue: () => fetchCryptoRiskScore(normalizedTicker),
    parseValue: () => {
      throw new Error('Value not found');
    },
    logger,
    waitUntil: 'domcontentloaded',
    navigationTimeoutMs: 2500,
    selectorTimeoutMs: 1000,
    waitForSelector: false,
    blockResources: false,
  };
};

/**
 * Create the scraping config needed to resolve a crypto risk score.
 * @param {string} ticker - Crypto ticker.
 * @returns {Object<string, { cacheTtlMs: number, providers: object[] }>}
 */
const cryptoRiskOptionCreator = (ticker) => {
  const normalizedTicker = normalizeCryptoTicker(ticker);
  const cacheKey = buildCryptoRiskCacheKey(normalizedTicker);

  return {
    [cacheKey]: {
      cacheTtlMs: CRYPTO_RISK_CACHE_TTL_MS,
      providers: [createCryptoRiskProvider(normalizedTicker)],
    },
  };
};

module.exports = {
  buildCryptoRiskCacheKey,
  bucketRiskScore,
  calculateAnnualizedVolatility,
  calculateDailyReturns,
  calculateMaxDrawdown,
  createCryptoRiskProvider,
  cryptoRiskOptionCreator,
  fetchCryptoRiskScore,
  normalizeCryptoTicker,
  scoreCryptoRiskFromHistory,
};
