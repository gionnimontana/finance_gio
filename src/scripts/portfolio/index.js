const scrapers = require('../../scrapers');
const api = require('../../api');

const getAssetsValue = async () => {
    const assetsSchema = await api.getAssetsSchema()

    const scraperOptions = assetsSchema.assets.map(asset => {
        if (asset[0] === 'Crypto') {
            const cryptoOption = scrapers.cryptoScraper.cryptoOptionsCreator(asset[1])
            return cryptoOption
        } else if (asset[0] === 'Equity') {
            const etfOption = scrapers.etfScraper.isinOptionCreator(asset[1])
            return etfOption
        } else {
            console.error('getAssetsValue - Invalid asset class: ', asset[0])
        }
        return options
    })

    const assetValues = await scrapers.multipleScraper(scraperOptions, 5)
    
    return assetValues
}

const getPortfolio = async () => {
    const assetsSchema = await api.getAssetsSchema()
    const assetValues = await getAssetsValue()

    const portfolio = Object.keys(assetValues).reduce((acc, key) => {
        const asset = assetsSchema.assets.find(asset => asset[1] === key)
        const quantity = asset[2]
        const value = assetValues[key]
        acc[key] = { quantity, value, total: quantity * value }
        return acc
    }, {})

    return portfolio
}

const getPortfolioByAssetClass = async () => {
    const portfolio = await getPortfolio()
    const assetsSchema = await api.getAssetsSchema()

    const portfolioByAssetClass = Object.keys(portfolio).reduce((acc, key) => {
        const asset = assetsSchema.assets.find(asset => asset[1] === key)
        const assetClass = asset[0]
        if (!acc[assetClass]) acc[assetClass] = 0
        acc[assetClass] += portfolio[key].total
        return acc
    }
    , {})

    return portfolioByAssetClass
}


module.exports = {
    getPortfolio,
    getPortfolioByAssetClass
}