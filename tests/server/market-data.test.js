const test = require('node:test')
const assert = require('node:assert/strict')

const scrapers = require('../../server/scrapers')
const marketData = require('../../server/scripts/marketData')
const isinRiskCache = require('../../server/api/isinRiskCache')
const cryptoRiskCache = require('../../server/api/cryptoRiskCache')
const goldRiskCache = require('../../server/api/goldRiskCache')

test('getAssetQuotes resolves stateless quotes from explicit dynamic assets', async (t) => {
  const originalMultipleScraper = scrapers.multipleScraper

  t.after(() => {
    scrapers.multipleScraper = originalMultipleScraper
  })

  scrapers.multipleScraper = async (options, maxRetries, refresh) => {
    assert.equal(maxRetries, 2)
    assert.equal(refresh, true)
    assert.deepEqual(options.map((option) => Object.keys(option)[0]), ['BTC', 'IE00B4L5Y983', 'physical-gold'])

    return {
      values: {
        BTC: 60321.45,
        IE00B4L5Y983: 98.76,
        'physical-gold': 95.12,
      },
      failures: ['physical-gold'],
    }
  }

  assert.deepEqual(
    await marketData.getAssetQuotes([
      { assetClass: 'Crypto', assetId: 'btc' },
      { assetClass: 'Isin', assetId: 'ie00b4l5y983' },
      { assetClass: 'Gold', assetId: 'physical-gold' },
    ], true),
    {
      values: {
        BTC: 60321.45,
        IE00B4L5Y983: 98.76,
        'physical-gold': 95.12,
      },
      failures: ['physical-gold'],
    }
  )
})

test('getAssetQuotes rejects unsupported quote-only asset classes', async () => {
  await assert.rejects(
    () => marketData.getAssetQuotes([{ assetClass: 'Other', assetId: 'cash-wallet' }], false),
    /unsupported assetClass/
  )
})

test('getAssetRiskIndicators resolves stateless risk payloads and local Other overrides', async (t) => {
  const originalMultipleScraper = scrapers.multipleScraper
  const originalPersistIsinRiskEntries = isinRiskCache.persistIsinRiskEntries
  const originalPersistCryptoRiskEntries = cryptoRiskCache.persistCryptoRiskEntries
  const originalPersistGoldRiskEntries = goldRiskCache.persistGoldRiskEntries

  t.after(() => {
    scrapers.multipleScraper = originalMultipleScraper
    isinRiskCache.persistIsinRiskEntries = originalPersistIsinRiskEntries
    cryptoRiskCache.persistCryptoRiskEntries = originalPersistCryptoRiskEntries
    goldRiskCache.persistGoldRiskEntries = originalPersistGoldRiskEntries
  })

  const persistedEntries = {
    isin: null,
    crypto: null,
    gold: null,
  }
  const scraperCallKeys = []

  isinRiskCache.persistIsinRiskEntries = (keys) => {
    persistedEntries.isin = keys
    return true
  }
  cryptoRiskCache.persistCryptoRiskEntries = (keys) => {
    persistedEntries.crypto = keys
    return true
  }
  goldRiskCache.persistGoldRiskEntries = (keys) => {
    persistedEntries.gold = keys
    return true
  }

  scrapers.multipleScraper = async (options, maxRetries, refresh) => {
    assert.equal(maxRetries, 1)
    assert.equal(refresh, false)

    const optionKeys = options.map((option) => Object.keys(option)[0])
    scraperCallKeys.push(optionKeys)
    const isinRiskKey = scrapers.etfScraper.buildIsinRiskCacheKey('IE00B4L5Y983')
    const cryptoRiskKey = scrapers.cryptoRiskScraper.buildCryptoRiskCacheKey('BTC')
    const goldRiskKey = scrapers.goldRiskScraper.buildGoldRiskCacheKey('physical-gold')

    return {
      values: {
        [optionKeys[0]]: optionKeys[0] === isinRiskKey
          ? 4
          : optionKeys[0] === cryptoRiskKey
            ? 6
            : 2,
      },
      failures: optionKeys[0] === goldRiskKey ? [goldRiskKey] : [],
    }
  }

  assert.deepEqual(
    await marketData.getAssetRiskIndicators(
      [
        { assetClass: 'Isin', assetId: 'ie00b4l5y983' },
        { assetClass: 'Crypto', assetId: 'btc' },
        { assetClass: 'Gold', assetId: 'physical-gold' },
        { assetClass: 'Other', assetId: 'cash-wallet' },
      ],
      false,
      { 'cash-wallet': 3 }
    ),
    {
      values: {
        IE00B4L5Y983: { value: 4, label: 'SRI' },
        BTC: { value: 6, label: 'Risk' },
        'physical-gold': { value: 2, label: 'Risk' },
        'cash-wallet': { value: 3, label: 'Risk' },
      },
      failures: ['physical-gold'],
    }
  )

  assert.deepEqual(persistedEntries, {
    isin: ['IE00B4L5Y983'],
    crypto: ['BTC'],
    gold: ['physical-gold'],
  })
  assert.deepEqual(scraperCallKeys, [
    [scrapers.etfScraper.buildIsinRiskCacheKey('IE00B4L5Y983')],
    [scrapers.cryptoRiskScraper.buildCryptoRiskCacheKey('BTC')],
    [scrapers.goldRiskScraper.buildGoldRiskCacheKey('physical-gold')],
  ])
})