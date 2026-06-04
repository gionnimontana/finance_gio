/**
 * Resolve stateless quote and risk data from explicit asset descriptors without reading stored user state.
 */
const scrapers = require('../scrapers')
const isinRiskCache = require('../api/isinRiskCache')
const cryptoRiskCache = require('../api/cryptoRiskCache')
const goldRiskCache = require('../api/goldRiskCache')

const QUOTE_SCRAPER_MAX_RETRIES = 2
const RISK_SCRAPER_MAX_RETRIES = 1
const OTHER_ASSET_DEFAULT_RISK = 1
const SUPPORTED_ASSET_CLASSES = ['Crypto', 'Isin', 'Gold', 'Other']
const SUPPORTED_QUOTE_ASSET_CLASSES = ['Crypto', 'Isin', 'Gold']

/**
 * Signal that a request payload is structurally invalid.
 */
class RequestValidationError extends Error {
  /**
   * @param {string} message - Human-readable validation message.
   */
  constructor(message) {
    super(message)
    this.name = 'RequestValidationError'
  }
}

/**
 * Convert a raw asset class into the supported canonical label.
 * @param {unknown} assetClass - Candidate asset class.
 * @returns {'Crypto'|'Isin'|'Gold'|'Other'|null}
 */
const normalizeAssetClass = (assetClass) => {
  const candidate = String(assetClass || '').trim()
  return SUPPORTED_ASSET_CLASSES.includes(candidate) ? candidate : null
}

/**
 * Normalize an asset id using the same case conventions expected by the scrapers.
 * @param {'Crypto'|'Isin'|'Gold'|'Other'} assetClass - Canonical asset class.
 * @param {unknown} assetId - Candidate asset id.
 * @returns {string}
 */
const normalizeAssetId = (assetClass, assetId) => {
  const normalizedAssetId = String(assetId || '').trim()

  if (!normalizedAssetId) {
    return ''
  }

  if (assetClass === 'Crypto' || assetClass === 'Isin') {
    return normalizedAssetId.toUpperCase()
  }

  return normalizedAssetId
}

/**
 * Normalize and de-duplicate explicit asset descriptors.
 * @param {unknown} assets - Candidate asset-descriptor array.
 * @param {string[]} allowedAssetClasses - Supported asset classes for the current call.
 * @returns {Array<{ assetClass: 'Crypto'|'Isin'|'Gold'|'Other', assetId: string }>}
 */
const normalizeAssetDescriptors = (assets, allowedAssetClasses = SUPPORTED_ASSET_CLASSES) => {
  if (!Array.isArray(assets)) {
    throw new RequestValidationError('Invalid payload: assets must be an array')
  }

  const seenAssets = new Set()
  const normalizedAssets = []

  for (const asset of assets) {
    if (!asset || typeof asset !== 'object' || Array.isArray(asset)) {
      throw new RequestValidationError('Invalid payload: each asset must be an object')
    }

    const assetClass = normalizeAssetClass(asset.assetClass)
    if (!assetClass || !allowedAssetClasses.includes(assetClass)) {
      throw new RequestValidationError(`Invalid payload: unsupported assetClass '${asset.assetClass}'`)
    }

    const assetId = normalizeAssetId(assetClass, asset.assetId)
    if (!assetId) {
      throw new RequestValidationError('Invalid payload: assetId is required for every asset')
    }

    const dedupeKey = `${assetClass}:${assetId}`
    if (seenAssets.has(dedupeKey)) {
      continue
    }

    seenAssets.add(dedupeKey)
    normalizedAssets.push({ assetClass, assetId })
  }

  return normalizedAssets
}

/**
 * Normalize an override map for Other assets.
 * @param {unknown} riskOverrides - Candidate risk-override map.
 * @param {Array<{ assetClass: 'Crypto'|'Isin'|'Gold'|'Other', assetId: string }>} assets - Normalized asset descriptors.
 * @returns {Record<string, number>}
 */
const normalizeRiskOverrides = (riskOverrides, assets) => {
  if (riskOverrides === undefined || riskOverrides === null) {
    return {}
  }

  if (!riskOverrides || typeof riskOverrides !== 'object' || Array.isArray(riskOverrides)) {
    throw new RequestValidationError('Invalid payload: riskOverrides must be an object map')
  }

  const allowedOtherAssetIds = new Set(
    assets
      .filter((asset) => asset.assetClass === 'Other')
      .map((asset) => asset.assetId)
  )

  return Object.entries(riskOverrides).reduce((acc, [rawAssetId, value]) => {
    const assetId = normalizeAssetId('Other', rawAssetId)

    if (!allowedOtherAssetIds.has(assetId)) {
      throw new RequestValidationError(`Invalid risk override assetId '${rawAssetId}'`) 
    }

    const numericValue = Number(value)
    if (!Number.isInteger(numericValue) || numericValue < 1 || numericValue > 7) {
      throw new RequestValidationError(`Invalid risk override for '${rawAssetId}': expected integer 1-7`)
    }

    acc[assetId] = numericValue
    return acc
  }, {})
}

/**
 * Convert a refresh flag into the shared boolean representation.
 * @param {unknown} refresh - Candidate refresh flag.
 * @returns {boolean}
 */
const isRefreshEnabled = (refresh) => refresh === true || String(refresh).toLowerCase() === 'true'

/**
 * Convert numeric values into the shared labeled risk-indicator response shape.
 * @param {Record<string, number>} values - Numeric values keyed by asset id.
 * @param {string} label - Badge label shown in the UI.
 * @returns {Record<string, { value: number, label: string }>}
 */
const labelRiskValues = (values, label) => Object.entries(values || {}).reduce((acc, [assetId, value]) => {
  const numericValue = Number(value)
  if (Number.isFinite(numericValue)) {
    acc[assetId] = { value: numericValue, label }
  }
  return acc
}, {})

/**
 * Merge multiple risk-indicator states into one payload.
 * @param {...{ values?: Record<string, { value: number, label: string }>, failures?: string[] }} states - Partial indicator states.
 * @returns {{ values: Record<string, { value: number, label: string }>, failures: string[] }}
 */
const buildRiskIndicatorPayload = (...states) => {
  const failures = []

  return states.reduce((acc, state) => {
    Object.assign(acc.values, state?.values || {})
    for (const failure of Array.isArray(state?.failures) ? state.failures : []) {
      if (!failures.includes(failure)) {
        failures.push(failure)
      }
    }
    acc.failures = failures
    return acc
  }, { values: {}, failures })
}

/**
 * Build quote scraper options from normalized dynamic assets.
 * @param {Array<{ assetClass: 'Crypto'|'Isin'|'Gold', assetId: string }>} assets - Dynamic asset descriptors.
 * @returns {Array<Record<string, object>>}
 */
const buildQuoteOptions = (assets) => assets.map((asset) => {
  if (asset.assetClass === 'Crypto') {
    return scrapers.cryptoScraper.cryptoOptionsCreator(asset.assetId)
  }

  if (asset.assetClass === 'Isin') {
    return scrapers.etfScraper.isinOptionCreator(asset.assetId)
  }

  return {
    [asset.assetId]: {
      providers: [scrapers.goldScraper.createGoldPreisProvider()],
    },
  }
})

/**
 * Resolve stateless quote values for the requested dynamic assets.
 * @param {unknown} assets - Candidate dynamic asset descriptors.
 * @param {unknown} refresh - Whether fresh scraper data should be requested.
 * @returns {Promise<{ values: Record<string, number>, failures: string[] }>}
 */
const getAssetQuotes = async (assets, refresh) => {
  const normalizedAssets = normalizeAssetDescriptors(assets, SUPPORTED_QUOTE_ASSET_CLASSES)

  if (!normalizedAssets.length) {
    return { values: {}, failures: [] }
  }

  return scrapers.multipleScraper(
    buildQuoteOptions(normalizedAssets),
    QUOTE_SCRAPER_MAX_RETRIES,
    isRefreshEnabled(refresh)
  )
}

/**
 * Resolve stateless ISIN risk indicators from explicit asset descriptors.
 * @param {Array<{ assetClass: 'Crypto'|'Isin'|'Gold'|'Other', assetId: string }>} assets - Normalized asset descriptors.
 * @param {boolean} refresh - Whether to bypass fresh cache entries.
 * @returns {Promise<{ values: Record<string, { value: number, label: string }>, failures: string[] }>}
 */
const getIsinRiskIndicatorsFromAssets = async (assets, refresh) => {
  const isinAssets = assets.filter((asset) => asset.assetClass === 'Isin')
  if (!isinAssets.length) {
    return { values: {}, failures: [] }
  }

  const cacheKeyToAssetId = isinAssets.reduce((acc, asset) => {
    acc[scrapers.etfScraper.buildIsinRiskCacheKey(asset.assetId)] = asset.assetId
    return acc
  }, {})
  const requestedIsins = isinAssets.map((asset) => asset.assetId)
  const scraperOptions = isinAssets.map((asset) => scrapers.etfScraper.isinRiskOptionCreator(asset.assetId))
  const scraperResult = await scrapers.multipleScraper(scraperOptions, RISK_SCRAPER_MAX_RETRIES, refresh)
  isinRiskCache.persistIsinRiskEntries(requestedIsins)

  const numericValues = Object.entries(scraperResult.values).reduce((acc, [cacheKey, value]) => {
    const assetId = cacheKeyToAssetId[cacheKey]
    if (assetId) {
      acc[assetId] = value
    }
    return acc
  }, {})

  return {
    values: labelRiskValues(numericValues, 'SRI'),
    failures: scraperResult.failures.map((cacheKey) => cacheKeyToAssetId[cacheKey] || cacheKey),
  }
}

/**
 * Resolve stateless crypto risk indicators from explicit asset descriptors.
 * @param {Array<{ assetClass: 'Crypto'|'Isin'|'Gold'|'Other', assetId: string }>} assets - Normalized asset descriptors.
 * @param {boolean} refresh - Whether to bypass fresh cache entries.
 * @returns {Promise<{ values: Record<string, { value: number, label: string }>, failures: string[] }>}
 */
const getCryptoRiskIndicatorsFromAssets = async (assets, refresh) => {
  const cryptoAssets = assets.filter((asset) => asset.assetClass === 'Crypto')
  if (!cryptoAssets.length) {
    return { values: {}, failures: [] }
  }

  const cacheKeyToAssetId = cryptoAssets.reduce((acc, asset) => {
    acc[scrapers.cryptoRiskScraper.buildCryptoRiskCacheKey(asset.assetId)] = asset.assetId
    return acc
  }, {})
  const requestedTickers = cryptoAssets.map((asset) => asset.assetId)
  const scraperOptions = cryptoAssets.map((asset) => scrapers.cryptoRiskScraper.cryptoRiskOptionCreator(asset.assetId))
  const scraperResult = await scrapers.multipleScraper(scraperOptions, RISK_SCRAPER_MAX_RETRIES, refresh)
  cryptoRiskCache.persistCryptoRiskEntries(requestedTickers)

  const numericValues = Object.entries(scraperResult.values).reduce((acc, [cacheKey, value]) => {
    const assetId = cacheKeyToAssetId[cacheKey]
    if (assetId) {
      acc[assetId] = value
    }
    return acc
  }, {})

  return {
    values: labelRiskValues(numericValues, 'Risk'),
    failures: scraperResult.failures.map((cacheKey) => cacheKeyToAssetId[cacheKey] || cacheKey),
  }
}

/**
 * Resolve stateless gold risk indicators from explicit asset descriptors.
 * @param {Array<{ assetClass: 'Crypto'|'Isin'|'Gold'|'Other', assetId: string }>} assets - Normalized asset descriptors.
 * @param {boolean} refresh - Whether to bypass fresh cache entries.
 * @returns {Promise<{ values: Record<string, { value: number, label: string }>, failures: string[] }>}
 */
const getGoldRiskIndicatorsFromAssets = async (assets, refresh) => {
  const goldAssets = assets.filter((asset) => asset.assetClass === 'Gold')
  if (!goldAssets.length) {
    return { values: {}, failures: [] }
  }

  const cacheKeyToAssetId = goldAssets.reduce((acc, asset) => {
    acc[scrapers.goldRiskScraper.buildGoldRiskCacheKey(asset.assetId)] = asset.assetId
    return acc
  }, {})
  const requestedAssetIds = goldAssets.map((asset) => asset.assetId)
  const scraperOptions = goldAssets.map((asset) => scrapers.goldRiskScraper.goldRiskOptionCreator(asset.assetId))
  const scraperResult = await scrapers.multipleScraper(scraperOptions, RISK_SCRAPER_MAX_RETRIES, refresh)
  goldRiskCache.persistGoldRiskEntries(requestedAssetIds)

  const numericValues = Object.entries(scraperResult.values).reduce((acc, [cacheKey, value]) => {
    const assetId = cacheKeyToAssetId[cacheKey]
    if (assetId) {
      acc[assetId] = value
    }
    return acc
  }, {})

  return {
    values: labelRiskValues(numericValues, 'Risk'),
    failures: scraperResult.failures.map((cacheKey) => cacheKeyToAssetId[cacheKey] || cacheKey),
  }
}

/**
 * Resolve default and manual risk values for explicit Other assets.
 * @param {Array<{ assetClass: 'Crypto'|'Isin'|'Gold'|'Other', assetId: string }>} assets - Normalized asset descriptors.
 * @param {Record<string, number>} riskOverrides - Sanitized per-asset overrides.
 * @returns {{ values: Record<string, { value: number, label: string }>, failures: string[] }}
 */
const getOtherRiskIndicatorsFromAssets = (assets, riskOverrides) => {
  const otherAssets = assets.filter((asset) => asset.assetClass === 'Other')
  if (!otherAssets.length) {
    return { values: {}, failures: [] }
  }

  const defaultValues = otherAssets.reduce((acc, asset) => {
    acc[asset.assetId] = OTHER_ASSET_DEFAULT_RISK
    return acc
  }, {})

  return {
    values: labelRiskValues({
      ...defaultValues,
      ...riskOverrides,
    }, 'Risk'),
    failures: [],
  }
}

/**
 * Resolve stateless risk indicators from explicit asset descriptors.
 * @param {unknown} assets - Candidate asset descriptors.
 * @param {unknown} refresh - Whether fresh scraper data should be requested.
 * @param {unknown} riskOverrides - Candidate risk-override map for Other assets.
 * @returns {Promise<{ values: Record<string, { value: number, label: string }>, failures: string[] }>}
 */
const getAssetRiskIndicators = async (assets, refresh, riskOverrides) => {
  const normalizedAssets = normalizeAssetDescriptors(assets)
  const normalizedRiskOverrides = normalizeRiskOverrides(riskOverrides, normalizedAssets)
  const shouldRefresh = isRefreshEnabled(refresh)

  return buildRiskIndicatorPayload(
    await getIsinRiskIndicatorsFromAssets(normalizedAssets, shouldRefresh),
    await getCryptoRiskIndicatorsFromAssets(normalizedAssets, shouldRefresh),
    await getGoldRiskIndicatorsFromAssets(normalizedAssets, shouldRefresh),
    getOtherRiskIndicatorsFromAssets(normalizedAssets, normalizedRiskOverrides)
  )
}

module.exports = {
  RequestValidationError,
  buildRiskIndicatorPayload,
  getAssetQuotes,
  getAssetRiskIndicators,
  getOtherRiskIndicatorsFromAssets,
  normalizeAssetDescriptors,
  normalizeRiskOverrides,
}