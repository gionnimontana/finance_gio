const test = require('node:test')
const assert = require('node:assert/strict')

const api = require('../../server/api')
const riskIndicators = require('../../server/scripts/riskIndicators')

test('buildRiskIndicatorPayload merges labeled ISIN and crypto indicators into the shared route shape', () => {
  assert.deepEqual(
    riskIndicators.buildRiskIndicatorPayload(
      {
        values: {
          IE00B4L5Y983: { value: 4, label: 'SRI' },
        },
        failures: ['IE00B4L5Y983'],
      },
      {
        values: {
          BTC: { value: 6, label: 'Risk' },
        },
        failures: ['BTC', 'IE00B4L5Y983'],
      },
      {
        values: {
          'physical-gold': { value: 2, label: 'Risk' },
        },
        failures: ['physical-gold'],
      }
    ),
    {
      values: {
        IE00B4L5Y983: { value: 4, label: 'SRI' },
        BTC: { value: 6, label: 'Risk' },
        'physical-gold': { value: 2, label: 'Risk' },
      },
      failures: ['IE00B4L5Y983', 'BTC', 'physical-gold'],
    }
  )
})

test('toLegacyRiskValues strips labels for the compatibility ISIN route', () => {
  assert.deepEqual(
    riskIndicators.toLegacyRiskValues({
      IE00B4L5Y983: { value: 4, label: 'SRI' },
      BTC: { value: 6, label: 'Risk' },
      'physical-gold': { value: 2, label: 'Risk' },
    }),
    {
      IE00B4L5Y983: 4,
      BTC: 6,
      'physical-gold': 2,
    }
  )
})

test('buildRiskIndicatorPayload keeps later states for the same asset id', () => {
  assert.deepEqual(
    riskIndicators.buildRiskIndicatorPayload(
      {
        values: {
          'cash-wallet': { value: 1, label: 'Risk' },
        },
        failures: [],
      },
      {
        values: {
          'cash-wallet': { value: 3, label: 'Risk' },
        },
        failures: [],
      }
    ),
    {
      values: {
        'cash-wallet': { value: 3, label: 'Risk' },
      },
      failures: [],
    }
  )
})

test('getOtherRiskIndicators returns default 1/7 and applies valid overrides for Other assets only', async (t) => {
  const originalGetAssetsSchema = api.getAssetsSchema
  t.after(() => {
    api.getAssetsSchema = originalGetAssetsSchema
  })

  api.getAssetsSchema = async () => ({
    assets: [
      ['Other', 'cash-wallet', 1500, 'Cash Wallet', 'Liquidity'],
      ['Other', 'collectibles', 2000, 'Collectibles', 'Equity'],
      ['Crypto', 'BTC', 0.5, 'Bitcoin Stack', 'Crypto'],
    ],
    riskOverrides: {
      'cash-wallet': 3,
      BTC: 7,
      collectibles: 8,
    },
  })

  assert.deepEqual(
    await riskIndicators.getOtherRiskIndicators('ignored-password-hash'),
    {
      values: {
        'cash-wallet': { value: 3, label: 'Risk' },
        collectibles: { value: 1, label: 'Risk' },
      },
      failures: [],
    }
  )
})
