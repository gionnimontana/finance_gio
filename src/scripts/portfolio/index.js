const scrapers = require('../../scrapers');

const getAssetsValue = async () => {
    const nasdaqIsin = 'LU1829221024' // Amundi Nasdaq-100 UCITS ETF DR EUR (C)
    const allWordIsin = 'IE00B4L5Y983' // iShares Core MSCI World UCITS ETF USD (Acc)
    const bitcoinSymbol = 'BTC' // Bitcoin
    const ethereumSymbol = 'ETH' // Ethereum
    const usdSymbol = 'USD' // USD

    const nasdaqOptions = scrapers.etfScraper.isinOptionCreator(nasdaqIsin)
    const allWorldOptions = scrapers.etfScraper.isinOptionCreator(allWordIsin)
    const bitcoinOptions = scrapers.cryptoScraper.cryptoOptionsCreator(bitcoinSymbol)
    const ethereumOptions = scrapers.cryptoScraper.cryptoOptionsCreator(ethereumSymbol)
    const usdOptions = scrapers.cryptoScraper.cryptoOptionsCreator(usdSymbol)

    const assetValues = await scrapers.multipleScraper([
        nasdaqOptions, 
        allWorldOptions, 
        bitcoinOptions, 
        ethereumOptions, 
        usdOptions
    ], 5)
    
    return assetValues
}

const getPortfolio = async () => {
    const assetQuantities = {
        'LU1829221024': 534, // Amundi Nasdaq-100 UCITS ETF DR EUR (C)
        'IE00B4L5Y983': 641, // iShares Core MSCI World UCITS ETF USD (Acc)
        'BTC': 0.78, // Bitcoin
        'ETH': 13.1, // Ethereum
        'USD': 3365, // USD
    }
    const assetValues = await getAssetsValue()

    const portfolio = Object.keys(assetValues).reduce((acc, key) => {
        const quantity = assetQuantities[key]
        const value = assetValues[key]
        acc[key] = { quantity, value, total: quantity * value }
        return acc
    }, {})

    return portfolio
}

const getPortfolioByAssetClass = async () => {
    const portfolio = await getPortfolio()
    const assetClasses = {
        'LU1829221024': 'Equity',
        'IE00B4L5Y983': 'Equity',
        'BTC': 'Crypto',
        'ETH': 'Crypto',
        'USD': 'Crypto',
    }

    const portfolioByAssetClass = Object.keys(portfolio).reduce((acc, key) => {
        const assetClass = assetClasses[key]
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