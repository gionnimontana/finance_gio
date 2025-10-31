const getAssetsSchema = async () => {
    return {
        // array of [assetClass,assetId, quantity]
        assets: [
            ['Equity', 'LU1829221024', 1520],
            ['Equity', 'IE00B4L5Y983', 1029],
            ['Equity', 'LU1900068914', 197],
            ['Crypto', 'BTC', 0.60068],
            ['Crypto', 'ETH', 13.37],
            ['Crypto', 'USDT', 9951],
            ['Liquidity', 'conto arancio', 53279],
            ['Liquidity', 'bbva', 1115],
            ['Liquidity', 'fineco', 252],
            ['Liquidity', 'revolut', 2368],
            ['Liquidity', 'satispay', 67],
            ['Liquidity', 'paypal', 176],
            ['Liquidity', 'cash', 110],
        ],
        prevMonthTotal: 433918
    }
}

module.exports = {
    getAssetsSchema,
}
