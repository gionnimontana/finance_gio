/**
 * Aggregate asset values into portfolio totals and stream incremental refresh progress to the API layer.
 */
const scrapers = require('../../scrapers');
const api = require('../../api');

const dynamicCategories = ['Isin', 'Crypto', 'Gold']

/**
 * Determine whether an asset relies on a live scraper instead of a static stored value.
 * @param {Array<unknown>} asset - Asset schema row.
 * @returns {boolean}
 */
const isDynamicAsset = (asset) => dynamicCategories.includes(asset[0])

/**
 * Resolve current asset values by combining live scraper results and static asset entries.
 * @param {string} passwordHash - The hashed password identifying the user.
 * @param {boolean} refresh - Whether cached scraper values should be refreshed.
 * @param {(progressData: { name: string, value: number|null, failed: boolean, index: number, total: number, cached?: boolean }) => void | null} [onProgress=null] - Optional progress callback for streamed updates.
 * @returns {Promise<{ assetValues: Record<string, number>, failures: string[] }>}
 */
const getAssetsValue = async (passwordHash, refresh, onProgress = null) => {
    const assetsSchema = await api.getAssetsSchema(passwordHash)

    const dynamicAssets = assetsSchema.assets.filter(asset => isDynamicAsset(asset))
    const staticAssets = assetsSchema.assets.filter(asset => !isDynamicAsset(asset))

    const scraperOptions = dynamicAssets.map(asset => {
        if (asset[0] === 'Crypto') {
            const cryptoOption = scrapers.cryptoScraper.cryptoOptionsCreator(asset[1])
            return cryptoOption
        } else if (asset[0] === 'Isin') {
            const etfOption = scrapers.etfScraper.isinOptionCreator(asset[1])
            return etfOption
        } else if (asset[0] === 'Gold') {
            const goldOption = scrapers.goldScraper.goldOptionsCreator()
            return goldOption
        }
        // Should never happen because we only build options for dynamicCategories.
        return null
    })

    const filteredScraperOptions = scraperOptions.filter(Boolean)

    const scraperResult = await scrapers.multipleScraper(filteredScraperOptions, 5, refresh, onProgress)

    const assetValues = { ...scraperResult.values, ...staticAssets.reduce((acc, asset) => {
        acc[asset[1]] = asset[2]
        return acc
    }, {}) }
    
    return { assetValues, failures: scraperResult.failures }
}

/**
 * Build the current portfolio totals grouped by view group.
 * @param {string} passwordHash - The hashed password identifying the user.
 * @param {boolean} refresh - Whether to refresh live scraper values and derived history totals.
 * @returns {Promise<object>}
 */
const getPortfolio = async (passwordHash, refresh) => {
    // Update prevMonthTotal and initYearNetworth from historical data when refreshing
    if (refresh) {
        await api.updatePrevMonthTotal(passwordHash)
        await api.updateInitYearNetworth(passwordHash)
    }
    
    const assetsSchema = await api.getAssetsSchema(passwordHash)
    const { assetValues, failures } = await getAssetsValue(passwordHash, refresh)

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
        const groupData = groupAssets.reduce((acc, asset) => {
            if (!portfolioRow[asset[1]]) return acc // Skip if asset has no value
            acc.details[asset[1]] = portfolioRow[asset[1]]
            acc.total += portfolioRow[asset[1]].total
            return acc
        }, { total: 0, details: {} })
        
        // Sort details by total value (descending)
        const sortedDetails = Object.entries(groupData.details)
            .sort(([, a], [, b]) => b.total - a.total)
            .reduce((sorted, [key, value]) => {
                sorted[key] = value
                return sorted
            }, {})
        
        acc[viewGroup] = { total: groupData.total, details: sortedDetails }
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
        initYearNetworth: assetsSchema.initYearNetworth,
        total: totalPortfolio,
        failures: failedAssets,
        ...assetsDetails
    }

    return portfolio
}

/**
 * Stream portfolio data with progress updates.
 * @param {string} passwordHash - The hashed password identifying the user.
 * @param {function} sendEvent - Function to send SSE events: sendEvent(eventType, data).
 * @param {boolean} [refresh=true] - Whether the stream should force a live refresh and update derived history.
 */
const streamPortfolio = async (passwordHash, sendEvent, refresh = true) => {
    // Update prevMonthTotal and initYearNetworth from historical data only for live refreshes.
    if (refresh) {
        await api.updatePrevMonthTotal(passwordHash)
        await api.updateInitYearNetworth(passwordHash)
    }
    
    const assetsSchema = await api.getAssetsSchema(passwordHash)
    
    // Build asset lookup map for quick access
    const assetLookup = {}
    assetsSchema.assets.forEach(asset => {
        assetLookup[asset[1]] = {
            assetClass: asset[0],
            assetId: asset[1],
            quantity: asset[2],
            displayName: asset[3],
            viewGroup: asset[4]
        }
    })

    // Track accumulated values for progressive totals
    const accumulatedValues = {}
    let currentFailures = []

    // Progress callback for scraper
    /**
     * Translate scraper progress into portfolio-level SSE progress payloads.
     * @param {{ name: string, value: number|null, failed: boolean, index: number, total: number }} progressData - Scraper progress update.
     * @returns {void}
     */
    const onProgress = (progressData) => {
        const { name, value, failed, index, total } = progressData
        const assetInfo = assetLookup[name]
        
        if (!assetInfo) return

        if (failed) {
            if (!currentFailures.includes(assetInfo.displayName)) {
                currentFailures.push(assetInfo.displayName)
            }
        }

        if (value !== null) {
            const assetTotal = isDynamicAsset([assetInfo.assetClass]) 
                ? assetInfo.quantity * value 
                : value
            accumulatedValues[name] = {
                quantity: isDynamicAsset([assetInfo.assetClass]) ? assetInfo.quantity : 1,
                value,
                total: assetTotal,
                displayName: assetInfo.displayName,
                viewGroup: assetInfo.viewGroup
            }
        }

        // Calculate current portfolio total
        const currentTotal = Object.values(accumulatedValues).reduce((sum, a) => sum + a.total, 0)

        // Send progress event
        sendEvent('progress', {
            assetName: assetInfo.displayName,
            assetId: name,
            value: value,
            assetTotal: accumulatedValues[name]?.total || null,
            failed,
            index,
            total,
            currentPortfolioTotal: currentTotal,
            prevMonthTotal: assetsSchema.prevMonthTotal,
            initYearNetworth: assetsSchema.initYearNetworth
        })
    }

    // Get asset values with progress callback
    const { assetValues, failures } = await getAssetsValue(passwordHash, refresh, onProgress)

    // Build final portfolio (same logic as getPortfolio)
    let viewGroupsMap = {}

    const portfolioRow = Object.keys(assetValues).reduce((acc, key) => {
        const asset = assetsSchema.assets.find(asset => asset[1] === key)
        if (!asset) return acc
        
        const value = assetValues[key]
        if (value === undefined || value === null) return acc
        
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
        const groupAssets = assetsSchema.assets.filter(asset => asset[4] === viewGroup)
        const groupData = groupAssets.reduce((acc, asset) => {
            if (!portfolioRow[asset[1]]) return acc
            acc.details[asset[1]] = portfolioRow[asset[1]]
            acc.total += portfolioRow[asset[1]].total
            return acc
        }, { total: 0, details: {} })
        
        const sortedDetails = Object.entries(groupData.details)
            .sort(([, a], [, b]) => b.total - a.total)
            .reduce((sorted, [key, value]) => {
                sorted[key] = value
                return sorted
            }, {})
        
        acc[viewGroup] = { total: groupData.total, details: sortedDetails }
        return acc
    }, {})

    const totalPortfolio = Object.values(portfolioRow).reduce((acc, asset) => acc + asset.total, 0)
    
    const failedAssets = failures.map(failureId => {
        const asset = assetsSchema.assets.find(a => a[1] === failureId)
        return asset ? asset[3] : failureId
    })

    const finalPortfolio = {
        prevMonthTotal: assetsSchema.prevMonthTotal,
        initYearNetworth: assetsSchema.initYearNetworth,
        total: totalPortfolio,
        failures: failedAssets,
        ...assetsDetails
    }

    // Update historical data only when the stream represents a user-triggered refresh.
    if (refresh) {
        await api.updateHistoricalData(passwordHash, finalPortfolio)
    }

    // Send complete event with final portfolio
    sendEvent('complete', finalPortfolio)

    return finalPortfolio
}

module.exports = {
    getPortfolio,
    streamPortfolio,
}
