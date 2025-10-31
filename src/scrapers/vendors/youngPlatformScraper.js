const core = require('../core')

/**
 * Create the params for the isinValueScraper
 * @param {'BTC' | 'ETH' } crypto - The crypto currency to scrape
 * @returns {Object} - The params for the isinValueScraper
 * @throws {Error} - If the value is not found or not a number or 0
*/
const cryptoOptionsCreator = (crypto) => {
    const lowerCaseCrypto = crypto.toLocaleLowerCase()
    const url = `https://youngplatform.com/exchange/${lowerCaseCrypto}-eur/`
    const logger = (msg) => console.log(`youngPlatformScraper - ${msg}`)
    const selector = '.sc-fqkvVR.hfyyHL'
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