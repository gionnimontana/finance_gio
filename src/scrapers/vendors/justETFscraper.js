const core = require('../core')

/**
 * Create the params for the isinValueScraper
 * @param {string} isin - The isin to scrape
 * @returns {Object} - The params for the isinValueScraper
 * @throws {Error} - If the value is not found or not a number or 0
*/
const isinOptionCreator = (isin) => {
    const url = `https://www.justetf.com/en/etf-profile.html?isin=${isin}#overview`
    const logger = (msg) => console.log(`isinValueScraper - ${msg}`)
    const selector = '#realtime-quotes > div > div > div > div > span:nth-child(2)'
    const selectorFunction = (selector) => {
        const rawValue = document.querySelector(selector).innerText
        return parseFloat(rawValue.replace(',', '.'))
    }
    return {
        [isin]: { url, selector, selectorFunction, logger }
    }
}

/**
 * Scrape the value of an isin
 * @param {string} isin - The crypto currency to scrape
 * @returns {Promise<number>} - The value of the crypto currency
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