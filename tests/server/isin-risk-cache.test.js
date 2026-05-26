const fs = require('fs')
const os = require('os')
const path = require('path')
const test = require('node:test')
const assert = require('node:assert/strict')

const authModulePath = require.resolve('../../server/auth')
const scraperCoreModulePath = require.resolve('../../server/scrapers/core')
const justEtfScraperModulePath = require.resolve('../../server/scrapers/vendors/justETFscraper')
const isinRiskCacheModulePath = require.resolve('../../server/api/isinRiskCache')

/**
 * Reload the modules involved in shared ISIN risk persistence after changing env state.
 * @returns {{ scraperCore: import('../../server/scrapers/core'), etfScraper: import('../../server/scrapers/vendors/justETFscraper'), isinRiskCache: import('../../server/api/isinRiskCache') }}
 */
const loadIsinRiskCacheModules = () => {
  delete require.cache[authModulePath]
  delete require.cache[scraperCoreModulePath]
  delete require.cache[justEtfScraperModulePath]
  delete require.cache[isinRiskCacheModulePath]

  return {
    scraperCore: require('../../server/scrapers/core'),
    etfScraper: require('../../server/scrapers/vendors/justETFscraper'),
    isinRiskCache: require('../../server/api/isinRiskCache'),
  }
}

/**
 * Run a test with an isolated temporary data directory.
 * @param {(context: { tempDir: string, scraperCore: import('../../server/scrapers/core'), etfScraper: import('../../server/scrapers/vendors/justETFscraper'), isinRiskCache: import('../../server/api/isinRiskCache') }) => void} worker - Test body.
 * @returns {void}
 */
const withTempDataDir = (worker) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pfb-isin-risk-cache-'))
  const previousDataDir = process.env.PFB_DATA_DIR

  process.env.PFB_DATA_DIR = tempDir

  try {
    worker({
      tempDir,
      ...loadIsinRiskCacheModules(),
    })
  } finally {
    delete require.cache[authModulePath]
    delete require.cache[scraperCoreModulePath]
    delete require.cache[justEtfScraperModulePath]
    delete require.cache[isinRiskCacheModulePath]

    if (previousDataDir === undefined) {
      delete process.env.PFB_DATA_DIR
    } else {
      process.env.PFB_DATA_DIR = previousDataDir
    }

    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}

test('loadPersistedIsinRiskCacheIntoRuntime creates the shared cache file on startup', { concurrency: false }, () => {
  withTempDataDir(({ tempDir, isinRiskCache }) => {
    const cachePath = path.join(tempDir, 'isinRiskCache.json')

    assert.equal(fs.existsSync(cachePath), false)
    assert.equal(isinRiskCache.loadPersistedIsinRiskCacheIntoRuntime(), 0)
    assert.equal(fs.existsSync(cachePath), true)
    assert.equal(fs.readFileSync(cachePath, 'utf8'), '{}\n')
  })
})

test('loadPersistedIsinRiskCacheIntoRuntime hydrates the scraper cache from disk', { concurrency: false }, () => {
  withTempDataDir(({ tempDir, scraperCore, etfScraper, isinRiskCache }) => {
    const updatedAt = 1716741000000
    const sourceUrl = 'https://example.com/kid.pdf'
    const cachePath = path.join(tempDir, 'isinRiskCache.json')
    fs.writeFileSync(cachePath, JSON.stringify({
      IE00B4L5Y983: {
        value: 4,
        updatedAt,
        provider: 'justetf-kid',
        sourceUrl,
      },
    }, null, 2), 'utf8')

    scraperCore.resetScraperState()
    assert.equal(isinRiskCache.loadPersistedIsinRiskCacheIntoRuntime(), 1)

    const cacheKey = etfScraper.buildIsinRiskCacheKey('ie00b4l5y983')
    assert.deepEqual(scraperCore.getCacheEntriesSnapshot([cacheKey]), {
      [cacheKey]: {
        value: 4,
        updatedAt,
        provider: 'justetf-kid',
        sourceUrl,
      },
    })
  })
})

test('persistIsinRiskEntries merges new runtime values into the shared cache file', { concurrency: false }, () => {
  withTempDataDir(({ tempDir, scraperCore, etfScraper, isinRiskCache }) => {
    const cachePath = path.join(tempDir, 'isinRiskCache.json')
    fs.writeFileSync(cachePath, JSON.stringify({
      IE00B4L5Y983: {
        value: 4,
        updatedAt: 1716741000000,
        provider: 'justetf-kid',
        sourceUrl: 'https://example.com/original.pdf',
      },
    }, null, 2), 'utf8')

    isinRiskCache.loadPersistedIsinRiskCacheIntoRuntime()
    scraperCore.hydrateCacheEntries({
      [etfScraper.buildIsinRiskCacheKey('GB00BJYDH287')]: {
        value: 6,
        updatedAt: 1716742000000,
        provider: 'justetf-kid',
        sourceUrl: 'https://example.com/gb00.pdf',
      },
    })

    assert.equal(isinRiskCache.persistIsinRiskEntries(['gb00bjydh287']), true)
    assert.deepEqual(JSON.parse(fs.readFileSync(cachePath, 'utf8')), {
      GB00BJYDH287: {
        value: 6,
        updatedAt: 1716742000000,
        provider: 'justetf-kid',
        sourceUrl: 'https://example.com/gb00.pdf',
      },
      IE00B4L5Y983: {
        value: 4,
        updatedAt: 1716741000000,
        provider: 'justetf-kid',
        sourceUrl: 'https://example.com/original.pdf',
      },
    })
  })
})
