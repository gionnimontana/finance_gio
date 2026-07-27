const fs = require('fs')
const os = require('os')
const path = require('path')
const test = require('node:test')
const assert = require('node:assert/strict')

const authModulePath = require.resolve('../../server/auth')
const scraperCoreModulePath = require.resolve('../../server/scrapers/core')
const goldRiskScraperModulePath = require.resolve('../../server/scrapers/vendors/goldRiskScraper')
const goldRiskCacheModulePath = require.resolve('../../server/api/goldRiskCache')

/**
 * Reload the modules involved in shared gold risk persistence after changing env state.
 * @returns {{ scraperCore: import('../../server/scrapers/core'), goldRiskScraper: import('../../server/scrapers/vendors/goldRiskScraper'), goldRiskCache: import('../../server/api/goldRiskCache') }}
 */
const loadGoldRiskCacheModules = () => {
  delete require.cache[authModulePath]
  delete require.cache[scraperCoreModulePath]
  delete require.cache[goldRiskScraperModulePath]
  delete require.cache[goldRiskCacheModulePath]

  return {
    scraperCore: require('../../server/scrapers/core'),
    goldRiskScraper: require('../../server/scrapers/vendors/goldRiskScraper'),
    goldRiskCache: require('../../server/api/goldRiskCache'),
  }
}

/**
 * Run a test with an isolated temporary data directory.
 * @param {(context: { tempDir: string, scraperCore: import('../../server/scrapers/core'), goldRiskScraper: import('../../server/scrapers/vendors/goldRiskScraper'), goldRiskCache: import('../../server/api/goldRiskCache') }) => void} worker - Test body.
 * @returns {void}
 */
const withTempDataDir = (worker) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pfb-gold-risk-cache-'))
  const previousDataDir = process.env.PFB_DATA_DIR

  process.env.PFB_DATA_DIR = tempDir

  try {
    worker({
      tempDir,
      ...loadGoldRiskCacheModules(),
    })
  } finally {
    delete require.cache[authModulePath]
    delete require.cache[scraperCoreModulePath]
    delete require.cache[goldRiskScraperModulePath]
    delete require.cache[goldRiskCacheModulePath]

    if (previousDataDir === undefined) {
      delete process.env.PFB_DATA_DIR
    } else {
      process.env.PFB_DATA_DIR = previousDataDir
    }

    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}

test('loadPersistedGoldRiskCacheIntoRuntime creates the shared cache file on startup', { concurrency: false }, () => {
  withTempDataDir(({ tempDir, goldRiskCache }) => {
    const cachePath = path.join(tempDir, 'goldRiskCache.json')

    assert.equal(fs.existsSync(cachePath), false)
    assert.equal(goldRiskCache.loadPersistedGoldRiskCacheIntoRuntime(), 0)
    assert.equal(fs.existsSync(cachePath), true)
    assert.equal(fs.readFileSync(cachePath, 'utf8'), '{}\n')
  })
})

test('loadPersistedGoldRiskCacheIntoRuntime hydrates the scraper cache from disk', { concurrency: false }, () => {
  withTempDataDir(({ tempDir, scraperCore, goldRiskScraper, goldRiskCache }) => {
    const updatedAt = 1716741000000
    const sourceUrl = 'https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=1y'
    const cachePath = path.join(tempDir, 'goldRiskCache.json')
    fs.writeFileSync(cachePath, JSON.stringify({
      'physical-gold': {
        value: 2,
        updatedAt,
        provider: 'yahoo-finance-gold-risk',
        sourceUrl,
      },
    }, null, 2), 'utf8')

    scraperCore.resetScraperState()
    assert.equal(goldRiskCache.loadPersistedGoldRiskCacheIntoRuntime(), 1)

    const cacheKey = goldRiskScraper.buildGoldRiskCacheKey('physical-gold')
    assert.deepEqual(scraperCore.getCacheEntriesSnapshot([cacheKey]), {
      [cacheKey]: {
        value: 2,
        updatedAt,
        provider: 'yahoo-finance-gold-risk',
        sourceUrl,
      },
    })
  })
})

test('persistGoldRiskEntries merges new runtime values into the shared cache file', { concurrency: false }, () => {
  withTempDataDir(({ tempDir, scraperCore, goldRiskScraper, goldRiskCache }) => {
    const cachePath = path.join(tempDir, 'goldRiskCache.json')
    fs.writeFileSync(cachePath, JSON.stringify({
      'physical-gold': {
        value: 2,
        updatedAt: 1716741000000,
        provider: 'yahoo-finance-gold-risk',
        sourceUrl: 'https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=1y',
      },
    }, null, 2), 'utf8')

    goldRiskCache.loadPersistedGoldRiskCacheIntoRuntime()
    scraperCore.hydrateCacheEntries({
      [goldRiskScraper.buildGoldRiskCacheKey('vault-gold')]: {
        value: 2,
        updatedAt: 1716742000000,
        provider: 'yahoo-finance-gold-risk',
        sourceUrl: 'https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=1y',
      },
    })

    assert.equal(goldRiskCache.persistGoldRiskEntries(['vault-gold']), true)
    assert.deepEqual(JSON.parse(fs.readFileSync(cachePath, 'utf8')), {
      'physical-gold': {
        value: 2,
        updatedAt: 1716741000000,
        provider: 'yahoo-finance-gold-risk',
        sourceUrl: 'https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=1y',
      },
      'vault-gold': {
        value: 2,
        updatedAt: 1716742000000,
        provider: 'yahoo-finance-gold-risk',
        sourceUrl: 'https://query1.finance.yahoo.com/v8/finance/chart/GC=F?interval=1d&range=1y',
      },
    })
  })
})
