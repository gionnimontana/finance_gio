const fs = require('fs')
const os = require('os')
const path = require('path')
const test = require('node:test')
const assert = require('node:assert/strict')

const authModulePath = require.resolve('../../server/auth')
const scraperCoreModulePath = require.resolve('../../server/scrapers/core')
const cryptoRiskScraperModulePath = require.resolve('../../server/scrapers/vendors/cryptoRiskScraper')
const cryptoRiskCacheModulePath = require.resolve('../../server/api/cryptoRiskCache')

/**
 * Reload the modules involved in shared crypto risk persistence after changing env state.
 * @returns {{ scraperCore: import('../../server/scrapers/core'), cryptoRiskScraper: import('../../server/scrapers/vendors/cryptoRiskScraper'), cryptoRiskCache: import('../../server/api/cryptoRiskCache') }}
 */
const loadCryptoRiskCacheModules = () => {
  delete require.cache[authModulePath]
  delete require.cache[scraperCoreModulePath]
  delete require.cache[cryptoRiskScraperModulePath]
  delete require.cache[cryptoRiskCacheModulePath]

  return {
    scraperCore: require('../../server/scrapers/core'),
    cryptoRiskScraper: require('../../server/scrapers/vendors/cryptoRiskScraper'),
    cryptoRiskCache: require('../../server/api/cryptoRiskCache'),
  }
}

/**
 * Run a test with an isolated temporary data directory.
 * @param {(context: { tempDir: string, scraperCore: import('../../server/scrapers/core'), cryptoRiskScraper: import('../../server/scrapers/vendors/cryptoRiskScraper'), cryptoRiskCache: import('../../server/api/cryptoRiskCache') }) => void} worker - Test body.
 * @returns {void}
 */
const withTempDataDir = (worker) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pfb-crypto-risk-cache-'))
  const previousDataDir = process.env.PFB_DATA_DIR

  process.env.PFB_DATA_DIR = tempDir

  try {
    worker({
      tempDir,
      ...loadCryptoRiskCacheModules(),
    })
  } finally {
    delete require.cache[authModulePath]
    delete require.cache[scraperCoreModulePath]
    delete require.cache[cryptoRiskScraperModulePath]
    delete require.cache[cryptoRiskCacheModulePath]

    if (previousDataDir === undefined) {
      delete process.env.PFB_DATA_DIR
    } else {
      process.env.PFB_DATA_DIR = previousDataDir
    }

    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}

test('loadPersistedCryptoRiskCacheIntoRuntime creates the shared cache file on startup', { concurrency: false }, () => {
  withTempDataDir(({ tempDir, cryptoRiskCache }) => {
    const cachePath = path.join(tempDir, 'cryptoRiskCache.json')

    assert.equal(fs.existsSync(cachePath), false)
    assert.equal(cryptoRiskCache.loadPersistedCryptoRiskCacheIntoRuntime(), 0)
    assert.equal(fs.existsSync(cachePath), true)
    assert.equal(fs.readFileSync(cachePath, 'utf8'), '{}\n')
  })
})

test('loadPersistedCryptoRiskCacheIntoRuntime hydrates the scraper cache from disk', { concurrency: false }, () => {
  withTempDataDir(({ tempDir, scraperCore, cryptoRiskScraper, cryptoRiskCache }) => {
    const updatedAt = 1716741000000
    const sourceUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/BTC-EUR?interval=1d&range=1y'
    const cachePath = path.join(tempDir, 'cryptoRiskCache.json')
    fs.writeFileSync(cachePath, JSON.stringify({
      BTC: {
        value: 6,
        updatedAt,
        provider: 'yahoo-finance-risk',
        sourceUrl,
      },
    }, null, 2), 'utf8')

    scraperCore.resetScraperState()
    assert.equal(cryptoRiskCache.loadPersistedCryptoRiskCacheIntoRuntime(), 1)

    const cacheKey = cryptoRiskScraper.buildCryptoRiskCacheKey('btc')
    assert.deepEqual(scraperCore.getCacheEntriesSnapshot([cacheKey]), {
      [cacheKey]: {
        value: 6,
        updatedAt,
        provider: 'yahoo-finance-risk',
        sourceUrl,
      },
    })
  })
})

test('persistCryptoRiskEntries merges new runtime values into the shared cache file', { concurrency: false }, () => {
  withTempDataDir(({ tempDir, scraperCore, cryptoRiskScraper, cryptoRiskCache }) => {
    const cachePath = path.join(tempDir, 'cryptoRiskCache.json')
    fs.writeFileSync(cachePath, JSON.stringify({
      BTC: {
        value: 6,
        updatedAt: 1716741000000,
        provider: 'yahoo-finance-risk',
        sourceUrl: 'https://query1.finance.yahoo.com/v8/finance/chart/BTC-EUR?interval=1d&range=1y',
      },
    }, null, 2), 'utf8')

    cryptoRiskCache.loadPersistedCryptoRiskCacheIntoRuntime()
    scraperCore.hydrateCacheEntries({
      [cryptoRiskScraper.buildCryptoRiskCacheKey('ETH')]: {
        value: 7,
        updatedAt: 1716742000000,
        provider: 'yahoo-finance-risk',
        sourceUrl: 'https://query1.finance.yahoo.com/v8/finance/chart/ETH-EUR?interval=1d&range=1y',
      },
    })

    assert.equal(cryptoRiskCache.persistCryptoRiskEntries(['eth']), true)
    assert.deepEqual(JSON.parse(fs.readFileSync(cachePath, 'utf8')), {
      BTC: {
        value: 6,
        updatedAt: 1716741000000,
        provider: 'yahoo-finance-risk',
        sourceUrl: 'https://query1.finance.yahoo.com/v8/finance/chart/BTC-EUR?interval=1d&range=1y',
      },
      ETH: {
        value: 7,
        updatedAt: 1716742000000,
        provider: 'yahoo-finance-risk',
        sourceUrl: 'https://query1.finance.yahoo.com/v8/finance/chart/ETH-EUR?interval=1d&range=1y',
      },
    })
  })
})
