const { test, expect } = require('@playwright/test')
const fs = require('fs')
const path = require('path')

delete process.env.PFB_TEST_MODE

const scraperCore = require('../../../server/scrapers/core')
const youngPlatformScraper = require('../../../server/scrapers/vendors/youngPlatformScraper')
const yahooFinanceScraper = require('../../../server/scrapers/vendors/yahooFinance')
const xeScraper = require('../../../server/scrapers/vendors/xeScraper')
const justEtfScraper = require('../../../server/scrapers/vendors/justETFscraper')
const goldPriceScraper = require('../../../server/scrapers/vendors/goldPriceScraper')
const beaconchainScraper = require('../../../server/scrapers/vendors/beaconchainScraper')
const etherScanScraper = require('../../../server/scrapers/vendors/etherScan')

const fixtureDir = path.join(__dirname, '..', 'fixtures', 'scrapers')

/**
 * Read a checked-in HTML fixture.
 * @param {string} fixtureName - Fixture filename.
 * @returns {string}
 */
const readFixture = (fixtureName) => fs.readFileSync(path.join(fixtureDir, fixtureName), 'utf8')

/**
 * Encode an HTML string as a data URL for Puppeteer-based runtime tests.
 * @param {string} html - Inline HTML content.
 * @returns {string}
 */
const toDataUrl = (html) => `data:text/html;charset=utf-8,${encodeURIComponent(html)}`

/**
 * Parse a positive numeric value from the first selector that exposes one.
 * @param {string[]} selectorCandidates - CSS selectors to try in order.
 * @returns {number}
 */
const parseCurrencyValue = (selectorCandidates) => {
  const parseNumericText = (text) => {
    if (!text) return null
    const match = text.replace(/\u00a0/g, ' ').match(/([\d.,\s]+)(?=\s*(?:USD|EUR|€)|$)/i)
    if (!match) return null
    const raw = match[1].replace(/\s/g, '')
    let normalized = raw

    if (raw.includes(',') && raw.includes('.')) {
      normalized = raw.lastIndexOf('.') > raw.lastIndexOf(',')
        ? raw.replace(/,/g, '')
        : raw.replace(/\./g, '').replace(',', '.')
    } else if (raw.includes(',')) {
      const decimalDigits = raw.split(',').pop()?.length || 0
      normalized = decimalDigits === 2 ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '')
    }

    const numericValue = Number(normalized)
    return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null
  }

  for (const selector of selectorCandidates) {
    const element = document.querySelector(selector)
    const numericValue = parseNumericText(element?.textContent || '')
    if (numericValue !== null) {
      return numericValue
    }
  }

  throw new Error('Value not found')
}

/**
 * Create a deterministic success provider backed by a data URL.
 * @param {string} name - Provider name.
 * @param {string} text - Visible text to parse.
 * @returns {{ name: string, url: string, selectors: string[], parseValue: Function, logger: Function, waitUntil: string, navigationTimeoutMs: number, selectorTimeoutMs: number, blockResources: boolean }}
 */
const createSuccessProvider = (name, text) => ({
  name,
  url: toDataUrl(`<!DOCTYPE html><html><body><div data-testid="price">${text}</div></body></html>`),
  selectors: ['[data-testid="price"]'],
  parseValue: parseCurrencyValue,
  logger: () => {},
  waitUntil: 'domcontentloaded',
  navigationTimeoutMs: 1500,
  selectorTimeoutMs: 1000,
  blockResources: false,
})

/**
 * Create a deterministic failure provider backed by a data URL.
 * @param {string} name - Provider name.
 * @returns {{ name: string, url: string, selectors: string[], parseValue: Function, logger: Function, waitUntil: string, navigationTimeoutMs: number, selectorTimeoutMs: number, blockResources: boolean }}
 */
const createFailureProvider = (name) => ({
  name,
  url: toDataUrl('<!DOCTYPE html><html><body><div>missing price</div></body></html>'),
  selectors: ['[data-testid="price"]'],
  parseValue: parseCurrencyValue,
  logger: () => {},
  waitUntil: 'domcontentloaded',
  navigationTimeoutMs: 1500,
  selectorTimeoutMs: 250,
  blockResources: false,
})

/**
 * Create a provider that hides its quote when automation signals leak through.
 * @param {string} name - Provider name.
 * @returns {{ name: string, url: string, selectors: string[], parseValue: Function, logger: Function, waitUntil: string, navigationTimeoutMs: number, selectorTimeoutMs: number, blockResources: boolean }}
 */
const createAutomationSensitiveProvider = (name) => ({
  name,
  url: toDataUrl(`<!DOCTYPE html><html><body><div data-testid="price"></div><script>
    const isAutomated = navigator.webdriver !== undefined || /HeadlessChrome/i.test(navigator.userAgent)
    document.querySelector('[data-testid="price"]').textContent = isAutomated ? '' : '117.70 EUR'
  </script></body></html>`),
  selectors: ['[data-testid="price"]'],
  parseValue: parseCurrencyValue,
  logger: () => {},
  waitUntil: 'domcontentloaded',
  navigationTimeoutMs: 1500,
  selectorTimeoutMs: 250,
  blockResources: false,
})

/**
 * Create a provider whose shell appears before the actual price text is populated.
 * @param {string} name - Provider name.
 * @returns {{ name: string, url: string, selectors: string[], waitSelectors: string[], waitForNonEmptyText: boolean, parseValue: Function, logger: Function, waitUntil: string, navigationTimeoutMs: number, selectorTimeoutMs: number, blockResources: boolean }}
 */
const createDelayedValueProvider = (name) => ({
  name,
  url: toDataUrl(`<!DOCTYPE html><html><body>
    <div id="shell">loading quote shell</div>
    <div data-testid="price"></div>
    <script>
      setTimeout(() => {
        document.querySelector('[data-testid="price"]').textContent = '117.70 EUR'
      }, 50)
    </script>
  </body></html>`),
  selectors: ['#shell', '[data-testid="price"]'],
  waitSelectors: ['[data-testid="price"]'],
  waitForNonEmptyText: true,
  parseValue: parseCurrencyValue,
  logger: () => {},
  waitUntil: 'domcontentloaded',
  navigationTimeoutMs: 1500,
  selectorTimeoutMs: 1000,
  blockResources: false,
})

/**
 * Create a provider that resolves its value through the fetch-only runtime path.
 * @param {string} name - Provider name.
 * @param {number} value - Numeric quote to resolve.
 * @returns {{ name: string, url: string, selectors: string[], fetchValue: Function, parseValue: Function, logger: Function, waitUntil: string, navigationTimeoutMs: number, selectorTimeoutMs: number, blockResources: boolean, waitForSelector: boolean }}
 */
const createFetchOnlyProvider = (name, value) => ({
  name,
  url: 'https://example.invalid/fetch-only-provider',
  selectors: ['body'],
  fetchValue: async () => value,
  parseValue: parseCurrencyValue,
  logger: () => {},
  waitUntil: 'domcontentloaded',
  navigationTimeoutMs: 1500,
  selectorTimeoutMs: 250,
  blockResources: false,
  waitForSelector: false,
})

/**
 * Assert that a provider parser can extract the expected value from a fixture.
 * @param {import('@playwright/test').Page} page - Playwright page instance.
 * @param {{ selectors: string[], parseValue: Function }} provider - Provider config under test.
 * @param {string} fixtureName - Fixture filename.
 * @param {number} expectedValue - Expected numeric result.
 * @returns {Promise<void>}
 */
const expectFixtureValue = async (page, provider, fixtureName, expectedValue) => {
  await page.setContent(readFixture(fixtureName))
  const value = await page.evaluate(provider.parseValue, provider.selectors)
  expect(value).toBeCloseTo(expectedValue, 2)
}

test.beforeEach(() => {
  scraperCore.resetScraperState()
})

test('parses the Young Platform fixture', async ({ page }) => {
  await expectFixtureValue(page, youngPlatformScraper.createYoungPlatformProvider('BTC'), 'young-platform.html', 40123.45)
})

test('parses the Yahoo Finance fixture', async ({ page }) => {
  await expectFixtureValue(page, yahooFinanceScraper.createYahooFinancePageProvider('BTC'), 'yahoo-finance.html', 65137.13)
})

test('parses Yahoo Finance small decimal quotes', async ({ page }) => {
  const provider = yahooFinanceScraper.createYahooFinancePageProvider('USDT')
  await page.setContent('<div data-testid="qsp-price">0,8523</div>')
  const value = await page.evaluate(provider.parseValue, provider.selectors)
  expect(value).toBeCloseTo(0.8523, 4)
})

test('parses the Yahoo Finance chart API payload', async () => {
  const value = yahooFinanceScraper.extractYahooFinanceChartPrice({
    chart: {
      result: [
        {
          meta: {
            regularMarketPrice: 65137.13,
          },
        },
      ],
    },
  })

  expect(value).toBeCloseTo(65137.13, 2)
})

test('parses the XE fixture', async ({ page }) => {
  await expectFixtureValue(page, xeScraper.createXeProvider('BTC'), 'xe.html', 40123.45)
})

test('parses the justETF quote API payload', async ({ page }) => {
  const provider = justEtfScraper.createJustEtfProvider('IE00B4L5Y983')
  await page.setContent(`<pre>${JSON.stringify({ latestQuote: { raw: 104.23, localized: '104.23' } })}</pre>`)

  const value = await page.evaluate(provider.parseValue, provider.selectors)
  expect(value).toBeCloseTo(104.23, 2)
})

test('prefers the raw justETF quote API value', async ({ page }) => {
  const provider = justEtfScraper.createJustEtfProvider('IE00B4L5Y983')
  await page.setContent(`<pre>${JSON.stringify({ latestQuote: { raw: 117.09, localized: '117,09' }, quoteTradingVenue: 'XETRA' })}</pre>`)

  const value = await page.evaluate(provider.parseValue, provider.selectors)
  expect(value).toBeCloseTo(117.09, 2)
})

test('parses the goldpreis fixture', async ({ page }) => {
  await expectFixtureValue(page, goldPriceScraper.createGoldPreisProvider(), 'goldpreis.html', 127.6)
})

test('parses the beaconchain fixture', async ({ page }) => {
  const provider = beaconchainScraper.validatorAdjustedBalanceOptionsCreator('123')['123'].providers[0]
  await expectFixtureValue(page, provider, 'beaconchain.html', 32.45)
})

test('parses the etherscan fixture', async ({ page }) => {
  const provider = etherScanScraper.cryptoWalletOptionsCreator('0xabc')['0xabc'].providers[0]
  await expectFixtureValue(page, provider, 'etherscan.html', 12345.67)
})

test('falls back to the secondary provider when the primary provider fails', async () => {
  const progress = []

  const result = await scraperCore.multipleUrlSelectorScraper([
    {
      BTC: {
        providers: [
          createFailureProvider('primary-provider'),
          createSuccessProvider('secondary-provider', '40,100.55 EUR'),
        ],
      },
    },
  ], 0, true, (event) => progress.push(event))

  expect(result.failures).toEqual([])
  expect(result.values.BTC).toBeCloseTo(40100.55, 2)
  expect(progress).toHaveLength(1)
  expect(progress[0]).toMatchObject({
    name: 'BTC',
    provider: 'secondary-provider',
    cached: false,
    stale: false,
    failed: false,
    index: 1,
    total: 1,
  })
})

test('reuses a fresh cache entry without scraping again when refresh is false', async () => {
  await scraperCore.multipleUrlSelectorScraper([
    {
      ETH: {
        cacheTtlMs: 30000,
        providers: [createSuccessProvider('fresh-provider', '2,345.67 EUR')],
      },
    },
  ], 0, true)

  const progress = []
  const result = await scraperCore.multipleUrlSelectorScraper([
    {
      ETH: {
        cacheTtlMs: 30000,
        providers: [createFailureProvider('broken-provider')],
      },
    },
  ], 0, false, (event) => progress.push(event))

  expect(result.failures).toEqual([])
  expect(result.values.ETH).toBeCloseTo(2345.67, 2)
  expect(progress).toHaveLength(1)
  expect(progress[0]).toMatchObject({
    name: 'ETH',
    cached: true,
    stale: false,
    failed: false,
  })
})

test('reuses a stale cache entry when all live providers fail', async () => {
  await scraperCore.multipleUrlSelectorScraper([
    {
      GOLD: {
        cacheTtlMs: 10,
        staleCacheTtlMs: 30000,
        providers: [createSuccessProvider('gold-provider', '127.60 EUR')],
      },
    },
  ], 0, true)

  await new Promise((resolve) => setTimeout(resolve, 20))

  const progress = []
  const result = await scraperCore.multipleUrlSelectorScraper([
    {
      GOLD: {
        cacheTtlMs: 10,
        staleCacheTtlMs: 30000,
        providers: [createFailureProvider('broken-provider')],
      },
    },
  ], 0, false, (event) => progress.push(event))

  expect(result.failures).toEqual([])
  expect(result.values.GOLD).toBeCloseTo(127.6, 2)
  expect(progress).toHaveLength(1)
  expect(progress[0]).toMatchObject({
    name: 'GOLD',
    cached: true,
    stale: true,
    failed: false,
  })
})

test('uses a stable browser profile for automation-sensitive quote pages', async () => {
  const result = await scraperCore.multipleUrlSelectorScraper([
    {
      ETF: {
        providers: [createAutomationSensitiveProvider('automation-sensitive-provider')],
      },
    },
  ], 0, true)

  expect(result.failures).toEqual([])
  expect(result.values.ETF).toBeCloseTo(117.7, 2)
})

test('waits for non-empty text before parsing shell-first quote pages', async () => {
  const result = await scraperCore.multipleUrlSelectorScraper([
    {
      DELAYED: {
        providers: [createDelayedValueProvider('delayed-value-provider')],
      },
    },
  ], 0, true)

  expect(result.failures).toEqual([])
  expect(result.values.DELAYED).toBeCloseTo(117.7, 2)
})

test('supports fetch-only providers without DOM parsing', async () => {
  const result = await scraperCore.multipleUrlSelectorScraper([
    {
      FETCHED: {
        providers: [createFetchOnlyProvider('fetch-only-provider', 117.09)],
      },
    },
  ], 0, true)

  expect(result.failures).toEqual([])
  expect(result.values.FETCHED).toBeCloseTo(117.09, 2)
})

test('optionValueScraper skips browser launch for fetch-only providers', async () => {
  const value = await scraperCore.optionValueScraper('FETCH_ONLY_SINGLE', {
    providers: [createFetchOnlyProvider('fetch-only-single-provider', 42.5)],
  }, 0)

  expect(value).toBeCloseTo(42.5, 2)
  expect(scraperCore.getScraperDiagnostics()).toEqual({
    browserLaunches: 0,
    pagesCreated: 0,
  })
})

test('multipleUrlSelectorScraper skips browser launch when every provider is fetch-only', async () => {
  const result = await scraperCore.multipleUrlSelectorScraper([
    {
      FETCH_A: {
        providers: [createFetchOnlyProvider('fetch-only-provider-a', 11.1)],
      },
    },
    {
      FETCH_B: {
        providers: [createFetchOnlyProvider('fetch-only-provider-b', 22.2)],
      },
    },
  ], 0, true)

  expect(result.failures).toEqual([])
  expect(result.values).toEqual({
    FETCH_A: 11.1,
    FETCH_B: 22.2,
  })
  expect(scraperCore.getScraperDiagnostics()).toEqual({
    browserLaunches: 0,
    pagesCreated: 0,
  })
})

test('reports failures when every provider fails and no cache exists', async () => {
  const progress = []

  const result = await scraperCore.multipleUrlSelectorScraper([
    {
      BROKEN: {
        providers: [createFailureProvider('broken-provider')],
      },
    },
  ], 0, true, (event) => progress.push(event))

  expect(result.values).toEqual({})
  expect(result.failures).toEqual(['BROKEN'])
  expect(progress).toHaveLength(1)
  expect(progress[0]).toMatchObject({
    name: 'BROKEN',
    failed: true,
    cached: false,
    stale: false,
  })
})

test('emits monotonic completion counters for concurrent scrapes', async () => {
  const progress = []

  const result = await scraperCore.multipleUrlSelectorScraper([
    { A: { providers: [createSuccessProvider('provider-a', '1,000.00 EUR')] } },
    { B: { providers: [createSuccessProvider('provider-b', '2,000.00 EUR')] } },
    { C: { providers: [createSuccessProvider('provider-c', '3,000.00 EUR')] } },
  ], 0, true, (event) => progress.push(event))

  expect(result.values).toEqual({
    A: 1000,
    B: 2000,
    C: 3000,
  })
  expect(progress).toHaveLength(3)
  expect(progress.map((event) => event.index)).toEqual([1, 2, 3])
  expect(progress.every((event) => event.total === 3)).toBeTruthy()
  expect(progress.map((event) => event.name).sort()).toEqual(['A', 'B', 'C'])
})