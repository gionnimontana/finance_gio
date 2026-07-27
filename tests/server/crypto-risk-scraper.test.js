const test = require('node:test')
const assert = require('node:assert/strict')

const cryptoRiskScraper = require('../../server/scrapers/vendors/cryptoRiskScraper')

test('scoreCryptoRiskFromHistory keeps a steady trend in the lowest bucket', () => {
  const closes = Array.from({ length: 366 }, (_, index) => 100 + index)

  assert.equal(cryptoRiskScraper.scoreCryptoRiskFromHistory(closes), 1)
})

test('scoreCryptoRiskFromHistory escalates volatile histories into the highest bucket', () => {
  const closes = Array.from({ length: 366 }, (_, index) => (index % 2 === 0 ? 100 : 220))

  assert.equal(cryptoRiskScraper.scoreCryptoRiskFromHistory(closes), 7)
})

test('cryptoRiskOptionCreator uses an isolated cache key for crypto risk values', () => {
  const cacheKey = cryptoRiskScraper.buildCryptoRiskCacheKey('BTC')
  const options = cryptoRiskScraper.cryptoRiskOptionCreator('BTC')

  assert.deepEqual(Object.keys(options), [cacheKey])
  assert.equal(options[cacheKey].providers[0].name, 'yahoo-finance-risk')
  assert.equal(options[cacheKey].cacheTtlMs, 24 * 60 * 60 * 1000)
})
