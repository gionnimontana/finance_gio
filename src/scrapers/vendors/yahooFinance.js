const core = require('../core')

/**
 * Create the params for the isinValueScraper
 * @param {'BTC' | 'ETH' } crypto - The crypto currency to scrape
 * @returns {Object} - The params for the isinValueScraper
 * @throws {Error} - If the value is not found or not a number or 0
*/
const cryptoOptionsCreator = (crypto) => {
    const url = `https://it.finance.yahoo.com/quote/${crypto}-EUR/`
    const logger = (msg) => console.log(`yahooFinanceScraper - ${msg}`)
    const selector = 'span.up1'
    const selectorFunction = (selector) => {
        const match = document.querySelector(selector).innerText
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
 * Scrape the value of a crypto currency
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