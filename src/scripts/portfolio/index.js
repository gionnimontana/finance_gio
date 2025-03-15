const scrapers = require('../../scrapers');
const api = require('../../api');

const isStaticAsset = (asset) => asset[0] !== 'Equity' && asset[0] !== 'Crypto'

const getAssetsValue = async (refresh) => {
    const assetsSchema = await api.getAssetsSchema()

    const dynamicAssets = assetsSchema.assets.filter(asset => asset[0] === 'Equity' || asset[0] === 'Crypto')
    const staticAssets = assetsSchema.assets.filter(asset => asset[0] !== 'Equity' && asset[0] !== 'Crypto')

    const scraperOptions = dynamicAssets.map(asset => {
        if (asset[0] === 'Crypto') {
            const cryptoOption = scrapers.cryptoScraper.cryptoOptionsCreator(asset[1])
            return cryptoOption
        } else if (asset[0] === 'Equity') {
            const etfOption = scrapers.etfScraper.isinOptionCreator(asset[1])
            return etfOption
        } 
        return options
    })

    const dynamicAssetValues = await scrapers.multipleScraper(scraperOptions, 5, refresh)

    const assetValues = { ...dynamicAssetValues, ...staticAssets.reduce((acc, asset) => {
        acc[asset[1]] = asset[2]
        return acc
    }, {}) }
    
    return assetValues
}

const getPortfolio = async (refresh) => {
    const assetsSchema = await api.getAssetsSchema()
    const assetValues = await getAssetsValue(refresh)

    let assetsMap = {}

    const portfolioRow = Object.keys(assetValues).reduce((acc, key) => {
        const asset = assetsSchema.assets.find(asset => asset[1] === key)
        const value = assetValues[key]
        assetsMap[asset[0]] = asset[0]
        if (isStaticAsset(asset)) {
            acc[key] = { quantity: 1, value, total: value }
            return acc
        } 
        const quantity = asset[2]
        acc[key] = { quantity, value, total: quantity * value }
        return acc
    }, {})

    const assetsDetails = Object.keys(assetsMap).reduce((acc, key) => {
        const categoryAssets = assetsSchema.assets.filter(asset => asset[0] === key)
        acc[key] = categoryAssets.reduce((acc, asset) => {
            acc.details[asset[1]] = portfolioRow[asset[1]]
            acc.total += portfolioRow[asset[1]].total
            return acc
        }, { total: 0, details: {} })
        return acc
    }, {})

    const totalPortfolio = Object.values(portfolioRow).reduce((acc, asset) => acc + asset.total, 0)
    const portfolio = {
        total: totalPortfolio,
        ...assetsDetails
    }

    return portfolio
}

module.exports = {
    getPortfolio,
}