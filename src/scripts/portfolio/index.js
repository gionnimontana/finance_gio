const scrapers = require('../../scrapers');
const api = require('../../api');

const dynamicCategories = ['Equity', 'Crypto', 'Commodities']
const isDynamicAsset = (asset) => dynamicCategories.includes(asset[0])

const getAssetsValue = async (refresh) => {
    const assetsSchema = await api.getAssetsSchema()

    const dynamicAssets = assetsSchema.assets.filter(asset => isDynamicAsset(asset))
    const staticAssets = assetsSchema.assets.filter(asset => !isDynamicAsset(asset))

    const scraperOptions = dynamicAssets.map(asset => {
        if (asset[0] === 'Crypto') {
            const cryptoOption = scrapers.cryptoScraper.cryptoOptionsCreator(asset[1])
            return cryptoOption
        } else if (asset[0] === 'Equity') {
            const etfOption = scrapers.etfScraper.isinOptionCreator(asset[1])
            return etfOption
        } else if (asset[0] === 'Commodities') {
            const goldOption = scrapers.goldScraper.goldOptionsCreator()
            return goldOption
        }
        return options
    })

    const scraperResult = await scrapers.multipleScraper(scraperOptions, 5, refresh)

    const assetValues = { ...scraperResult.values, ...staticAssets.reduce((acc, asset) => {
        acc[asset[1]] = asset[2]
        return acc
    }, {}) }
    
    return { assetValues, failures: scraperResult.failures }
}

const getPortfolio = async (refresh) => {
    const assetsSchema = await api.getAssetsSchema()
    const { assetValues, failures } = await getAssetsValue(refresh)

    let viewGroupsMap = {}

    const portfolioRow = Object.keys(assetValues).reduce((acc, key) => {
        const asset = assetsSchema.assets.find(asset => asset[1] === key)
        if (!asset) return acc // Skip if asset not found in schema
        
        const value = assetValues[key]
        if (value === undefined || value === null) return acc // Skip if no value available
        
        // Use viewGroup (index 4) for grouping
        const viewGroup = asset[4]
        viewGroupsMap[viewGroup] = viewGroup
        
        if (!isDynamicAsset(asset)) {
            acc[key] = { quantity: 1, value, total: value, displayName: asset[3] }
            return acc
        } 
        const quantity = asset[2]
        acc[key] = { quantity, value, total: quantity * value, displayName: asset[3] }
        return acc
    }, {})

    const assetsDetails = Object.keys(viewGroupsMap).reduce((acc, viewGroup) => {
        // Filter assets by viewGroup (index 4)
        const groupAssets = assetsSchema.assets.filter(asset => asset[4] === viewGroup)
        acc[viewGroup] = groupAssets.reduce((acc, asset) => {
            if (!portfolioRow[asset[1]]) return acc // Skip if asset has no value
            acc.details[asset[1]] = portfolioRow[asset[1]]
            acc.total += portfolioRow[asset[1]].total
            return acc
        }, { total: 0, details: {} })
        return acc
    }, {})

    const totalPortfolio = Object.values(portfolioRow).reduce((acc, asset) => acc + asset.total, 0)
    
    // Map failure IDs to display names
    const failedAssets = failures.map(failureId => {
        const asset = assetsSchema.assets.find(a => a[1] === failureId)
        return asset ? asset[3] : failureId
    })

    const portfolio = {
        prevMonthTotal: assetsSchema.prevMonthTotal,
        total: totalPortfolio,
        failures: failedAssets,
        ...assetsDetails
    }

    return portfolio
}

module.exports = {
    getPortfolio,
}
