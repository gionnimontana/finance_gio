const fs = require('fs')
const os = require('os')
const path = require('path')
const test = require('node:test')
const assert = require('node:assert/strict')

const authModulePath = require.resolve('../../server/auth')
const apiModulePath = require.resolve('../../server/api')

/**
 * Reload auth and API modules after swapping the test data directory.
 * @returns {{ auth: import('../../server/auth'), api: import('../../server/api') }}
 */
const loadPortfolioHistoryModules = () => {
  delete require.cache[authModulePath]
  delete require.cache[apiModulePath]

  return {
    auth: require('../../server/auth'),
    api: require('../../server/api'),
  }
}

/**
 * Run one test with an isolated temporary backend data directory.
 * @param {(context: { tempDir: string, auth: import('../../server/auth'), api: import('../../server/api') }) => Promise<void>} worker - Test body.
 * @returns {Promise<void>}
 */
const withTempDataDir = async (worker) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pfb-portfolio-history-'))
  const previousDataDir = process.env.PFB_DATA_DIR

  process.env.PFB_DATA_DIR = tempDir

  try {
    await worker({
      tempDir,
      ...loadPortfolioHistoryModules(),
    })
  } finally {
    delete require.cache[authModulePath]
    delete require.cache[apiModulePath]

    if (previousDataDir === undefined) {
      delete process.env.PFB_DATA_DIR
    } else {
      process.env.PFB_DATA_DIR = previousDataDir
    }

    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}

test('updateHistoricalData keeps the last full current-month snapshot when a refresh is partial', { concurrency: false }, async () => {
  await withTempDataDir(async ({ auth, api }) => {
    const passwordHash = auth.hashPassword('portfolio-history-refresh-test')
    auth.createUser(passwordHash)

    await api.updateHistoricalData(passwordHash, {
      total: 21200,
      Liquidity: { total: 1500 },
      Crypto: { total: 18000 },
      Gold: { total: 900 },
      Houses: { total: 0 },
      Equity: { total: 800 },
    })

    const fullSnapshot = await api.getHistoricalData(passwordHash)
    assert.equal(fullSnapshot.length, 1)
    assert.equal(fullSnapshot[0].total, 21200)
    assert.equal(fullSnapshot[0].Crypto.total, 18000)

    await api.updateHistoricalData(passwordHash, {
      total: 21500,
      Liquidity: { total: 1500 },
      Crypto: { total: 20000 },
      failures: ['Gold Reserve', 'World ETF'],
    })

    const afterPartialRefresh = await api.getHistoricalData(passwordHash)
    assert.deepEqual(afterPartialRefresh, fullSnapshot)

    await api.updateHistoricalData(passwordHash, {
      total: 23500,
      Liquidity: { total: 1500 },
      Crypto: { total: 20000 },
      Gold: { total: 1000 },
      Houses: { total: 0 },
      Equity: { total: 1000 },
      failures: [],
    })

    const afterSuccessfulRefresh = await api.getHistoricalData(passwordHash)
    assert.equal(afterSuccessfulRefresh.length, 1)
    assert.equal(afterSuccessfulRefresh[0].total, 23500)
    assert.equal(afterSuccessfulRefresh[0].Gold.total, 1000)
    assert.equal(afterSuccessfulRefresh[0].Equity.total, 1000)
  })
})