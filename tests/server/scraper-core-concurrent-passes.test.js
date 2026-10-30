const test = require('node:test')
const assert = require('node:assert/strict')

const scraperCoreModulePath = require.resolve('../../server/scrapers/core')

const buildOption = (name, value, delayMs) => ({
  [name]: {
    providers: [{
      name: `fetch-${name}`,
      url: `https://example.com/${name}`,
      fetchValue: async () => {
        await new Promise((resolve) => setTimeout(resolve, delayMs))
        return value
      },
      parseValue: (v) => v,
    }],
  },
})

test('concurrent scrape passes with different assets each get their own values', { concurrency: false }, async () => {
  delete require.cache[scraperCoreModulePath]
  const scraperCore = require('../../server/scrapers/core')
  scraperCore.resetScraperState()

  try {
    const [riskResult, portfolioResult] = await Promise.all([
      scraperCore.multipleUrlSelectorScraper([buildOption('risk-btc', 5, 30)], 0, false),
      scraperCore.multipleUrlSelectorScraper([buildOption('BTC', 42000, 10)], 0, true),
    ])

    assert.deepEqual(riskResult, { values: { 'risk-btc': 5 }, failures: [] })
    assert.deepEqual(portfolioResult, { values: { BTC: 42000 }, failures: [] })
  } finally {
    scraperCore.resetScraperState()
    delete require.cache[scraperCoreModulePath]
  }
})
