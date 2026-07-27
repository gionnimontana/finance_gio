const test = require('node:test')
const assert = require('node:assert/strict')

const scraperCoreModulePath = require.resolve('../../server/scrapers/core')

/**
 * Reload the scraper core after changing env-backed runtime settings.
 * @returns {import('../../server/scrapers/core')}
 */
const loadScraperCore = () => {
  delete require.cache[scraperCoreModulePath]
  return require('../../server/scrapers/core')
}

test('multipleUrlSelectorScraper reports unresolved assets as failures after an unexpected runtime error', { concurrency: false }, async () => {
  const previousConcurrency = process.env.PFB_SCRAPER_CONCURRENCY
  process.env.PFB_SCRAPER_CONCURRENCY = '1'

  const scraperCore = loadScraperCore()
  scraperCore.resetScraperState()

  try {
    const result = await scraperCore.multipleUrlSelectorScraper([
      {
        BTC: {
          providers: [{
            name: 'fetch-provider-btc',
            url: 'https://example.com/btc',
            fetchValue: async () => 42000,
            parseValue: (value) => value,
          }],
        },
      },
      {
        IE00B4L5Y983: {
          providers: [{
            name: 'fetch-provider-etf',
            url: 'https://example.com/etf',
            fetchValue: async () => 100,
            parseValue: (value) => value,
          }],
        },
      },
      {
        'physical-gold': {
          providers: [{
            name: 'fetch-provider-gold',
            url: 'https://example.com/gold',
            fetchValue: async () => 60,
            parseValue: (value) => value,
          }],
        },
      },
    ], 0, true, ({ name }) => {
      if (name === 'BTC') {
        throw new Error('Simulated progress callback failure')
      }
    })

    assert.deepEqual(result.values, { BTC: 42000 })
    assert.deepEqual(new Set(result.failures), new Set(['IE00B4L5Y983', 'physical-gold']))
  } finally {
    scraperCore.resetScraperState()
    delete require.cache[scraperCoreModulePath]

    if (previousConcurrency === undefined) {
      delete process.env.PFB_SCRAPER_CONCURRENCY
    } else {
      process.env.PFB_SCRAPER_CONCURRENCY = previousConcurrency
    }
  }
})