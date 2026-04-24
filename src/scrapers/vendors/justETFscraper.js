/**
 * Scrape ETF quote data from justETF using the shared browser helpers.
 */
const core = require('../core')

/**
 * Create the scraping config needed to resolve an ETF quote by ISIN.
 * @param {string} isin - The isin to scrape
 * @returns {Object<string, { url: string, selector: string, selectorFunction: Function, logger: Function }>} - Scraper options keyed by ISIN.
 * @throws {Error} - If the value is not found or not a number or 0
*/
const isinOptionCreator = (isin) => {
    const url = `https://www.justetf.com/en/etf-profile.html?isin=${isin}#overview`
    /**
     * Log scraping progress for the current ETF lookup.
     * @param {string} msg - Message to print.
     * @returns {void}
     */
    const logger = (msg) => console.log(`isinValueScraper - ${msg}`)
    const selector = '#realtime-quotes > div > div > div > div > span:nth-child(2)'
    /**
     * Parse the ETF quote text into a numeric value.
     * @param {string} selector - CSS selector for the quote element.
     * @returns {number}
     */
    const selectorFunction = (selector) => {
        const rawValue = document.querySelector(selector).innerText
        return parseFloat(rawValue.replace(',', '.'))
    }
    return {
        [isin]: { url, selector, selectorFunction, logger }
    }
}

/**
 * Scrape the quote value for an ETF identified by ISIN.
 * @param {string} isin - The ISIN to scrape
 * @returns {Promise<number>} - The current ETF quote
 * @throws {Error} - If the value is not found or not a number or 0
*/
const isinValueScraper = async (isin) => {
    const params = isinOptionCreator(isin)
    const { url, selector, selectorFunction, logger } = params[isin]
    return core.urlSelectorScraper(url, selector, selectorFunction, logger)
}

module.exports = {
    isinValue: isinValueScraper,
    isinOptionCreator,
}