const getAssetsSchema = async () => {
    return {
        // array of [assetClass,assetId, quantity]
        assets: [
            ['Equity', 'LU1829221024', 683],
            ['Equity', 'IE00B4L5Y983', 729],
            ['Equity', 'LU1900068914', 67],
            ['Equity', 'LU0290358497', 5],
            ['Crypto', 'BTC', 0.537],
            ['Crypto', 'ETH', 13.1],
            ['Crypto', 'USD', 17317],
            ['Liquidity', 'contoDeposito1', 15000],
            ['RealEstate', 'house', 120000],
        ]
    }
}

module.exports = {
    getAssetsSchema,
}