/**
 * Scrape crypto-to-EUR prices from Young Platform using the shared browser helpers.
 */
const core = require('../core')

/**
 * Create the scraping config needed to resolve a crypto price from Young Platform.
 * @param {'BTC' | 'ETH' } crypto - The crypto currency to scrape
 * @returns {Object<string, { url: string, selector: string, selectorFunction: Function, logger: Function }>} - Scraper options keyed by ticker.
 * @throws {Error} - If the value is not found or not a number or 0
*/
const cryptoOptionsCreator = (crypto) => {
    const lowerCaseCrypto = crypto.toLocaleLowerCase()
    const url = `https://youngplatform.com/exchange/${lowerCaseCrypto}-eur/`
    /**
     * Log scraping progress for the current Young Platform lookup.
     * @param {string} msg - Message to print.
     * @returns {void}
     */
    const logger = (msg) => console.log(`youngPlatformScraper - ${msg}`)
    const selector = '.sc-fqkvVR.hfyyHL'
    /**
     * Parse the quoted EUR price from the Young Platform page.
     * @param {string} selector - CSS selector for the quote element.
     * @returns {number}
     */
    const selectorFunction = (selector) => {
        const numbericValue =  Number(document.querySelector(selector).innerText.split('€')[0].trim())
        if (!numbericValue) throw new Error('Value not found');
        return numbericValue;
    }
    return {
        [crypto]: { url, selector, selectorFunction, logger }
    }
}

/**
 * Scrape a crypto-to-EUR rate from Young Platform.
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