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
            ['Commodities', 'physical-gold', 150, 'Physical Gold', 'Gold'], // quantity in grams
            ['Liquidity', 'bbva', 891, 'Bbva', 'Liquidity'],
            ['Liquidity', 'fineco', 1500, 'Fineco', 'Liquidity'],
            ['Liquidity', 'revolut', 2695, 'Revolut', 'Liquidity'],
            ['Liquidity', 'satispay', 201, 'Satispay', 'Liquidity'],
            ['Liquidity', 'paypal', 206, 'Paypal', 'Liquidity'],
            ['Liquidity', 'cash', 600, 'Cash', 'Liquidity'],
        ],
        prevMonthTotal: 423221
    }
}

// Historical data for portfolio history view
// Format: array of monthly snapshots with viewGroup totals
const getHistoricalData = async () => {
    return [
        { label: 'Feb 2023', date: '2023-02', total: 225426, Liquidity: { total: 29752 }, Crypto: { total: 37674 }, Houses: { total: 158000 }, Equity: { total: 0 }, Gold: { total: 0 } },
        { label: 'Mar 2023', date: '2023-03', total: 230635, Liquidity: { total: 30387 }, Crypto: { total: 42248 }, Houses: { total: 158000 }, Equity: { total: 0 }, Gold: { total: 0 } },
        { label: 'Apr 2023', date: '2023-04', total: 237175, Liquidity: { total: 34200 }, Crypto: { total: 44975 }, Houses: { total: 158000 }, Equity: { total: 0 }, Gold: { total: 0 } },
        { label: 'May 2023', date: '2023-05', total: 235435, Liquidity: { total: 34062 }, Crypto: { total: 42623 }, Houses: { total: 158000 }, Equity: { total: 750 }, Gold: { total: 0 } },
        { label: 'Jun 2023', date: '2023-06', total: 233192, Liquidity: { total: 33940 }, Crypto: { total: 40502 }, Houses: { total: 120000 }, Equity: { total: 38750 }, Gold: { total: 0 } },
        { label: 'Jul 2023', date: '2023-07', total: 229943.02, Liquidity: { total: 27736 }, Crypto: { total: 43627.82 }, Houses: { total: 120000 }, Equity: { total: 38579.20 }, Gold: { total: 0 } },
        { label: 'Aug 2023', date: '2023-08', total: 230091.35, Liquidity: { total: 28425.63 }, Crypto: { total: 43336.02 }, Houses: { total: 120000 }, Equity: { total: 38329.70 }, Gold: { total: 0 } },
        { label: 'Sep 2023', date: '2023-09', total: 231015.90, Liquidity: { total: 31416 }, Crypto: { total: 39717.80 }, Houses: { total: 120000 }, Equity: { total: 39882.10 }, Gold: { total: 0 } },
        { label: 'Oct 2023', date: '2023-10', total: 238465.52, Liquidity: { total: 30449.67 }, Crypto: { total: 44378.25 }, Houses: { total: 120000 }, Equity: { total: 43637.60 }, Gold: { total: 0 } },
        { label: 'Nov 2023', date: '2023-11', total: 252991.60, Liquidity: { total: 31730 }, Crypto: { total: 57105.60 }, Houses: { total: 120000 }, Equity: { total: 44156 }, Gold: { total: 0 } },
        { label: 'Dec 2023', date: '2023-12', total: 268970.90, Liquidity: { total: 29560 }, Crypto: { total: 65268.10 }, Houses: { total: 120000 }, Equity: { total: 54142.80 }, Gold: { total: 0 } },
        { label: 'Jan 2024', date: '2024-01', total: 277953.60, Liquidity: { total: 30000 }, Crypto: { total: 66957.60 }, Houses: { total: 120000 }, Equity: { total: 60996 }, Gold: { total: 0 } },
        { label: 'Feb 2024', date: '2024-02', total: 312264.20, Liquidity: { total: 33000 }, Crypto: { total: 96158.20 }, Houses: { total: 120000 }, Equity: { total: 63106 }, Gold: { total: 0 } },
        { label: 'Mar 2024', date: '2024-03', total: 325252.20, Liquidity: { total: 33813 }, Crypto: { total: 99886.20 }, Houses: { total: 120000 }, Equity: { total: 71553 }, Gold: { total: 0 } },
        { label: 'Apr 2024', date: '2024-04', total: 314586.50, Liquidity: { total: 32900 }, Crypto: { total: 86974.50 }, Houses: { total: 120000 }, Equity: { total: 74712 }, Gold: { total: 0 } },
        { label: 'May 2024', date: '2024-05', total: 329680.20, Liquidity: { total: 33500 }, Crypto: { total: 95515.20 }, Houses: { total: 120000 }, Equity: { total: 80665 }, Gold: { total: 0 } },
        { label: 'Jun 2024', date: '2024-06', total: 326190.56, Liquidity: { total: 31652 }, Crypto: { total: 88780.56 }, Houses: { total: 120000 }, Equity: { total: 85758 }, Gold: { total: 0 } },
        { label: 'Jul 2024', date: '2024-07', total: 327057.62, Liquidity: { total: 29000 }, Crypto: { total: 87993.62 }, Houses: { total: 120000 }, Equity: { total: 90064 }, Gold: { total: 0 } },
        { label: 'Aug 2024', date: '2024-08', total: 314760.15, Liquidity: { total: 31925 }, Crypto: { total: 73506.15 }, Houses: { total: 120000 }, Equity: { total: 89329 }, Gold: { total: 0 } },
        { label: 'Sep 2024', date: '2024-09', total: 326205.76, Liquidity: { total: 33134 }, Crypto: { total: 77312.76 }, Houses: { total: 120000 }, Equity: { total: 95759 }, Gold: { total: 0 } },
        { label: 'Oct 2024', date: '2024-10', total: 338328.80, Liquidity: { total: 29500 }, Crypto: { total: 85858.80 }, Houses: { total: 120000 }, Equity: { total: 102970 }, Gold: { total: 0 } },
        { label: 'Nov 2024', date: '2024-11', total: 379022.76, Liquidity: { total: 29000 }, Crypto: { total: 120282.76 }, Houses: { total: 120000 }, Equity: { total: 109740 }, Gold: { total: 0 } },
        { label: 'Dec 2024', date: '2024-12', total: 383770.95, Liquidity: { total: 30000 }, Crypto: { total: 115995.95 }, Houses: { total: 120000 }, Equity: { total: 117775 }, Gold: { total: 0 } },
        { label: 'Jan 2025', date: '2025-01', total: 383215.64, Liquidity: { total: 28000 }, Crypto: { total: 110891.64 }, Houses: { total: 120000 }, Equity: { total: 124324 }, Gold: { total: 0 } },
        { label: 'Feb 2025', date: '2025-02', total: 363312.60, Liquidity: { total: 15000 }, Crypto: { total: 88915.60 }, Houses: { total: 120000 }, Equity: { total: 139397 }, Gold: { total: 0 } },
        { label: 'Mar 2025', date: '2025-03', total: 340736.64, Liquidity: { total: 18500 }, Crypto: { total: 78162.64 }, Houses: { total: 0 }, Equity: { total: 244074 }, Gold: { total: 0 } },
        { label: 'Apr 2025', date: '2025-04', total: 339237.94, Liquidity: { total: 21000 }, Crypto: { total: 81337.94 }, Houses: { total: 0 }, Equity: { total: 236900 }, Gold: { total: 0 } },
        { label: 'May 2025', date: '2025-05', total: 373480.23, Liquidity: { total: 25593 }, Crypto: { total: 93838.23 }, Houses: { total: 0 }, Equity: { total: 254049 }, Gold: { total: 0 } },
        { label: 'Jun 2025', date: '2025-06', total: 384699.64, Liquidity: { total: 50278 }, Crypto: { total: 92739.64 }, Houses: { total: 0 }, Equity: { total: 241682 }, Gold: { total: 0 } },
        { label: 'Jul 2025', date: '2025-07', total: 422932.03, Liquidity: { total: 52675 }, Crypto: { total: 114911.03 }, Houses: { total: 0 }, Equity: { total: 255346 }, Gold: { total: 0 } },
        { label: 'Aug 2025', date: '2025-08', total: 419004.69, Liquidity: { total: 53228 }, Crypto: { total: 113601.69 }, Houses: { total: 0 }, Equity: { total: 252175 }, Gold: { total: 0 } },
        { label: 'Sep 2025', date: '2025-09', total: 433918.90, Liquidity: { total: 57367 }, Crypto: { total: 113782.90 }, Houses: { total: 0 }, Equity: { total: 262769 }, Gold: { total: 0 } },
        { label: 'Oct 2025', date: '2025-10', total: 447489.26, Liquidity: { total: 60973 }, Crypto: { total: 109739.26 }, Houses: { total: 0 }, Equity: { total: 276777 }, Gold: { total: 0 } },
        { label: 'Nov 2025', date: '2025-11', total: 424186.92, Liquidity: { total: 62829 }, Crypto: { total: 89616.92 }, Houses: { total: 0 }, Equity: { total: 271741 }, Gold: { total: 0 } },
        { label: 'Dec 2025', date: '2025-12', total: 421121.53, Liquidity: { total: 64272 }, Crypto: { total: 86087.53 }, Houses: { total: 0 }, Equity: { total: 270762 }, Gold: { total: 0 } },
    ];
}

module.exports = {
    getAssetsSchema,
    getHistoricalData,
}
