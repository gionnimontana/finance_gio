const getAssetsSchema = async () => {
    return {
        // array of [assetClass, assetId, quantity, displayName, cat]
        assets: [
            ['Equity', 'LU1829221024', 1520, 'Nasdaq ETF'],
            ['Equity', 'IE00B4L5Y983', 1029, 'All World ETF'],
            ['Equity', 'LU1900068914', 197, 'MSCI China ETF'],
            ['Equity', 'IE000JJPY166', 3330, 'ETF monetario'],
            ['Equity', 'GB00BJYDH287', 277, 'Physical Bitcoin'],
            ['Crypto', 'BTC', 0.68268, 'Bitcoin'],
            ['Crypto', 'ETH', 13.39, 'Ethereum'],
            ['Crypto', 'USDT', 462, 'USDT'],
            ['Liquidity', 'bbva', 891, 'Bbva'],
            ['Liquidity', 'fineco', 1500, 'Fineco'],
            ['Liquidity', 'revolut', 2695, 'Revolut'],
            ['Liquidity', 'satispay', 201, 'Satispay'],
            ['Liquidity', 'paypal', 206, 'Paypal'],
            ['Liquidity', 'cash', 600, 'Cash'],
            ['Commodities', 'physical-gold', 150, 'Physical Gold'], // quantity in grams
        ],
        prevMonthTotal: 423221
    }
}

module.exports = {
    getAssetsSchema,
}
