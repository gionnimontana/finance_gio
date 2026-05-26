/**
 * Shared 1-7 market-risk scoring helpers used by non-ISIN assets.
 */
const DEFAULT_VOLATILITY_LOOKBACK_DAYS = 90;
const DEFAULT_MAX_DRAWDOWN_LOOKBACK_DAYS = 365;

/**
 * Convert a metric into the 1-7 risk bucket scale.
 * @param {number} value - Computed metric.
 * @param {number[]} thresholds - Inclusive bucket thresholds for scores 1-6.
 * @returns {number}
 */
const bucketRiskScore = (value, thresholds) => {
  for (let index = 0; index < thresholds.length; index += 1) {
    if (value <= thresholds[index]) {
      return index + 1;
    }
  }

  return 7;
};

/**
 * Convert a close-price history into percentage returns.
 * @param {number[]} closes - Positive close prices in chronological order.
 * @returns {number[]}
 */
const calculateDailyReturns = (closes) => {
  const returns = [];

  for (let index = 1; index < closes.length; index += 1) {
    const previous = Number(closes[index - 1]);
    const current = Number(closes[index]);
    if (!Number.isFinite(previous) || !Number.isFinite(current) || previous <= 0 || current <= 0) {
      continue;
    }

    returns.push((current - previous) / previous);
  }

  return returns;
};

/**
 * Calculate annualized realized volatility from recent daily closes.
 * @param {number[]} closes - Positive close prices in chronological order.
 * @param {number} [lookbackDays=90] - Number of daily closes to use for volatility.
 * @returns {number}
 */
const calculateAnnualizedVolatility = (closes, lookbackDays = DEFAULT_VOLATILITY_LOOKBACK_DAYS) => {
  const recentCloses = closes.slice(-(lookbackDays + 1));
  const returns = calculateDailyReturns(recentCloses);

  if (returns.length < 30) {
    throw new Error('Insufficient history for volatility scoring');
  }

  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + ((value - mean) ** 2), 0) / returns.length;
  return Math.sqrt(variance) * Math.sqrt(365);
};

/**
 * Calculate maximum drawdown from recent daily closes.
 * @param {number[]} closes - Positive close prices in chronological order.
 * @param {number} [lookbackDays=365] - Number of daily closes to use for drawdown.
 * @returns {number}
 */
const calculateMaxDrawdown = (closes, lookbackDays = DEFAULT_MAX_DRAWDOWN_LOOKBACK_DAYS) => {
  const recentCloses = closes.slice(-lookbackDays);
  if (recentCloses.length < 2) {
    throw new Error('Insufficient history for drawdown scoring');
  }

  let peak = recentCloses[0];
  let maxDrawdown = 0;

  for (const close of recentCloses) {
    if (close > peak) {
      peak = close;
    }

    const drawdown = peak > 0 ? (peak - close) / peak : 0;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return maxDrawdown;
};

/**
 * Score a daily close history into a deterministic 1-7 risk value.
 * @param {number[]} closes - Positive close prices in chronological order.
 * @param {{ volatilityThresholds: number[], maxDrawdownThresholds: number[], volatilityLookbackDays?: number, maxDrawdownLookbackDays?: number }} config - Threshold configuration.
 * @returns {number}
 */
const scoreRiskFromHistory = (closes, config) => {
  const {
    volatilityThresholds,
    maxDrawdownThresholds,
    volatilityLookbackDays = DEFAULT_VOLATILITY_LOOKBACK_DAYS,
    maxDrawdownLookbackDays = DEFAULT_MAX_DRAWDOWN_LOOKBACK_DAYS,
  } = config;
  const annualizedVolatility = calculateAnnualizedVolatility(closes, volatilityLookbackDays);
  const maxDrawdown = calculateMaxDrawdown(closes, maxDrawdownLookbackDays);
  const volatilityScore = bucketRiskScore(annualizedVolatility, volatilityThresholds);
  const drawdownScore = bucketRiskScore(maxDrawdown, maxDrawdownThresholds);
  return Math.max(volatilityScore, drawdownScore);
};

module.exports = {
  bucketRiskScore,
  calculateAnnualizedVolatility,
  calculateDailyReturns,
  calculateMaxDrawdown,
  DEFAULT_MAX_DRAWDOWN_LOOKBACK_DAYS,
  DEFAULT_VOLATILITY_LOOKBACK_DAYS,
  scoreRiskFromHistory,
};
