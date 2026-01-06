const getAssetsSchema = async () => {
    return {
        // array of [assetClass, assetId, quantity, displayName, viewGroup]
        assets: [
            ['Equity', 'LU1829221024', 1520, 'ETF Nasdaq', 'Equity'],
            ['Equity', 'IE00B4L5Y983', 1029, 'ETF All World', 'Equity'],
            ['Equity', 'LU1900068914', 197, 'ETF MSCI China', 'Equity'],
            ['Equity', 'IE000JJPY166', 3330, 'ETF Monetario', 'Liquidity'],
            ['Equity', 'GB00BJYDH287', 277, 'ETC Bitcoin', 'Crypto'],
            ['Crypto', 'BTC', 0.68268, 'Bitcoin', 'Crypto'],
            ['Crypto', 'ETH', 13.39, 'Ethereum', 'Crypto'],
            ['Crypto', 'USDT', 462, 'USDT', 'Liquidity'],
            ['Liquidity', 'bbva', 891, 'Bbva', 'Liquidity'],
            ['Liquidity', 'fineco', 1500, 'Fineco', 'Liquidity'],
            ['Liquidity', 'revolut', 2695, 'Revolut', 'Liquidity'],
            ['Liquidity', 'satispay', 201, 'Satispay', 'Liquidity'],
            ['Liquidity', 'paypal', 206, 'Paypal', 'Liquidity'],
            ['Liquidity', 'cash', 600, 'Cash', 'Liquidity'],
            ['Commodities', 'physical-gold', 150, 'Physical Gold', 'Gold'], // quantity in grams
        ],
        prevMonthTotal: 423221
    }
}

module.exports = {
    getAssetsSchema,
}
