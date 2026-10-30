const test = require('node:test')
const assert = require('node:assert/strict')

const goldRiskScraper = require('../../server/scrapers/vendors/goldRiskScraper')

test('scoreGoldRiskFromHistory keeps a steady trend in the lowest bucket', () => {
  const closes = Array.from({ length: 366 }, (_, index) => 100 + index)

  assert.equal(goldRiskScraper.scoreGoldRiskFromHistory(closes), 1)
})

test('scoreGoldRiskFromHistory escalates volatile histories into the highest bucket', () => {
  const closes = Array.from({ length: 366 }, (_, index) => (index % 2 === 0 ? 100 : 220))

  assert.equal(goldRiskScraper.scoreGoldRiskFromHistory(closes), 7)
})

test('goldRiskOptionCreator uses an isolated cache key for gold risk values', () => {
  const cacheKey = goldRiskScraper.buildGoldRiskCacheKey('physical-gold')
  const options = goldRiskScraper.goldRiskOptionCreator('physical-gold')

  assert.deepEqual(Object.keys(options), [cacheKey])
  assert.equal(options[cacheKey].providers[0].name, 'yahoo-finance-gold-risk')
  assert.equal(options[cacheKey].cacheTtlMs, 24 * 60 * 60 * 1000)
})

test('gold volatility is annualized with trading days rather than calendar days', () => {
  const closes = Array.from({ length: 91 }, (_, index) => (index % 2 === 0 ? 100 : 101))
  const calendar = goldRiskScraper.calculateAnnualizedVolatility(closes, 90, 365)
  const trading = goldRiskScraper.calculateAnnualizedVolatility(closes, 90, 252)

  assert.ok(Math.abs(trading / calendar - Math.sqrt(252 / 365)) < 1e-9)
})
