const getAssetsSchema = async () => {
    return {
        // array of [assetClass,assetId, quantity]
        assets: [
            ['Equity', 'LU1829221024', 534],
            ['Equity', 'IE00B4L5Y983', 641],
            ['Crypto', 'BTC', 0.78],
            ['Crypto', 'ETH', 13.1],
            ['Crypto', 'USD', 3365]
        ]
    }
}

module.exports = {
    getAssetsSchema,
}