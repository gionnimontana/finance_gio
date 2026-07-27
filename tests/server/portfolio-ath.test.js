const test = require('node:test')
const assert = require('node:assert/strict')

const api = require('../../server/api')
const portfolioScripts = require('../../server/scripts/portfolio')

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const formatMonthDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
const formatMonthLabel = (date) => `${monthNames[date.getMonth()]} ${date.getFullYear()}`

test('getPortfolio derives ATH from saved history before the current month', async () => {
    const now = new Date()
    const previousMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, 1)
    const originalApi = {
        getAssetsSchema: api.getAssetsSchema,
        getHistoricalData: api.getHistoricalData,
        updatePrevMonthTotal: api.updatePrevMonthTotal,
        updateInitYearNetworth: api.updateInitYearNetworth,
    }

    api.getAssetsSchema = async () => ({
        assets: [['Other', 'cash-wallet', 250, 'Cash Wallet', 'Liquidity']],
        viewGroups: ['Liquidity'],
        prevMonthTotal: null,
        initYearNetworth: null,
    })
    api.getHistoricalData = async () => ([
        { label: formatMonthLabel(twoMonthsAgo), date: formatMonthDate(twoMonthsAgo), total: 180 },
        { label: formatMonthLabel(previousMonth), date: formatMonthDate(previousMonth), total: 190 },
        { label: formatMonthLabel(now), date: formatMonthDate(now), total: 240 },
    ])
    api.updatePrevMonthTotal = async () => {}
    api.updateInitYearNetworth = async () => {}

    try {
        const portfolio = await portfolioScripts.getPortfolio('test-user', false)

        assert.equal(portfolio.total, 250)
        assert.equal(portfolio.allTimeHighTotal, 190)
        assert.equal(portfolio.allTimeHighLabel, formatMonthLabel(previousMonth))
    } finally {
        api.getAssetsSchema = originalApi.getAssetsSchema
        api.getHistoricalData = originalApi.getHistoricalData
        api.updatePrevMonthTotal = originalApi.updatePrevMonthTotal
        api.updateInitYearNetworth = originalApi.updateInitYearNetworth
    }
})