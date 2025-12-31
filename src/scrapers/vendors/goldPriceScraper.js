const core = require('../core')

/**
 * Create the params for the gold price scraper
 * @returns {Object} - The params for the gold price scraper
 * @throws {Error} - If the value is not found or not a number or 0
 */
const goldOptionsCreator = () => {
    // Gold price per gram in EUR from gold.de (German gold price portal)
    const url = 'https://www.gold.de/kurse/goldpreis/'
    const logger = (msg) => console.log(`goldPriceScraper - ${msg}`)
    // Selector for the gold price per gram in the table
    const selector = 'table'
    const selectorFunction = (selector) => {
        // Find the table with gold prices and extract the price per gram
        const tables = document.querySelectorAll('table')
        for (const table of tables) {
            const rows = table.querySelectorAll('tr')
            for (const row of rows) {
                const cells = row.querySelectorAll('td')
                if (cells.length >= 2) {
                    const label = cells[0]?.innerText?.trim() || ''
                    if (label.includes('1 Gramm') || label.includes('1 g)')) {
                        const priceText = cells[1]?.innerText?.trim() || ''
                        // Extract number from format like "118,78 EUR"
                        const match = priceText.match(/([\d.,]+)\s*EUR/)
                        if (match) {
                            // Convert German number format (comma as decimal) to standard
                            const numericValue = parseFloat(match[1].replace('.', '').replace(',', '.'))
                            if (!isNaN(numericValue) && numericValue > 0) {
                                return numericValue
                            }
                        }
                    }
                }
            }
        }
        throw new Error('Gold price per gram not found')
    }
    return {
        ['physical-gold']: { url, selector, selectorFunction, logger }
    }
}

/**
 * Scrape the value of gold per gram in EUR
 * @returns {Promise<number>} - The value of gold per gram in EUR
 * @throws {Error} - If the value is not found or not a number or 0
 */
const goldValue = async () => {
    const params = goldOptionsCreator()
    const { url, selector, selectorFunction, logger } = params['physical-gold']
    return core.urlSelectorScraper(url, selector, selectorFunction, logger)
}

module.exports = {
    goldValue,
    goldOptionsCreator,
}
