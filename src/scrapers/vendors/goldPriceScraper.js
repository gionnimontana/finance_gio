/**
 * Scrape spot gold prices from goldpreis.de using the shared browser helpers.
 */
const core = require('../core')

/**
 * Create the scraping config needed to resolve the gold price per gram in EUR.
 * @returns {Object<string, { url: string, selector: string, selectorFunction: Function, logger: Function }>} - Scraper options keyed by asset id.
 * @throws {Error} - If the value is not found or not a number or 0
 */
const goldOptionsCreator = () => {
    // Gold price per gram in EUR from goldpreis.de (German gold price portal)
    // Note: gold.de was previously used but is experiencing technical issues
    const url = 'https://www.goldpreis.de/'
    /**
     * Log scraping progress for the gold price lookup.
     * @param {string} msg - Message to print.
     * @returns {void}
     */
    const logger = (msg) => console.log(`goldPriceScraper - ${msg}`)
    // Selector for the gold price per gram in the table
    const selector = 'table'
    /**
     * Parse the price-per-gram entry from the tables returned by the page.
     * @param {string} selector - CSS selector for the candidate price table.
     * @returns {number}
     */
    const selectorFunction = (selector) => {
        // Find the table with gold prices and extract the price per gram
        const tables = document.querySelectorAll('table')
        for (const table of tables) {
            const rows = table.querySelectorAll('tr')
            for (const row of rows) {
                const cells = row.querySelectorAll('td')
                if (cells.length >= 2) {
                    const label = cells[0]?.innerText?.trim() || ''
                    if (label.includes('1 Gramm') || label.includes('1 g')) {
                        // Get the last cell which contains the EUR price
                        const priceText = cells[cells.length - 1]?.innerText?.trim() || ''
                        // Extract number from format like "127,60 EUR"
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
 * Scrape the current gold price per gram in EUR.
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
