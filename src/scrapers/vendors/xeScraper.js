/**
 * Scrape crypto-to-EUR exchange rates from XE using the shared browser helpers.
 */
const core = require('../core')

/**
 * Create the scraping config needed to resolve a crypto price from XE.
 * @param {'BTC' | 'ETH' } crypto - The crypto currency to scrape
 * @returns {Object<string, { url: string, selector: string, selectorFunction: Function, logger: Function }>} - Scraper options keyed by ticker.
 * @throws {Error} - If the value is not found or not a number or 0
*/
const cryptoOptionsCreator = (crypto) => {
    const url = `https://www.xe.com/currencycharts/?from=${crypto}&to=EUR`
    /**
     * Log scraping progress for the current XE lookup.
     * @param {string} msg - Message to print.
     * @returns {void}
     */
    const logger = (msg) => console.log(`cryptoValueScraper - ${msg}`)
    const selector = '.mx-2.font-semibold'
    /**
     * Parse the quoted EUR price from the XE page.
     * @param {string} selector - CSS selector for the quote element.
     * @returns {number}
     */
    const selectorFunction = (selector) => {
        const rawValue = document.querySelector(selector).innerText
        const match = rawValue.match(/\d{1,3}(?:,\d{3})*(?:\.\d+)?(?=\sEUR)/);
        if (!match) throw new Error('Value not found');
        const numbericValue = parseFloat(match[0].replace(/,/g, ''));
        if (!numbericValue) throw new Error('Value not found');
        return numbericValue;
    }
    return {
        [crypto]: { url, selector, selectorFunction, logger }
    }
}

/**
 * Scrape a crypto-to-EUR rate from XE.
 * @param {'BTC' | 'ETH' } crypto - The crypto currency to scrape
 * @returns {Promise<number>} - The value of the crypto currency
 * @throws {Error} - If the value is not found or not a number or 0
*/
const cryptoValue = async (crypto) => {
    const params = cryptoOptionsCreator(crypto)
    const { url, selector, selectorFunction, logger } = params[crypto]
    return core.urlSelectorScraper(url, selector, selectorFunction, logger)
}

module.exports = {
    cryptoValue: cryptoValue,
    cryptoOptionsCreator,
}