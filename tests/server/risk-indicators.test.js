const test = require('node:test')
const assert = require('node:assert/strict')

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
