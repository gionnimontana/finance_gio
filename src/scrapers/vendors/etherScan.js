const core = require('../core')

/**
 * Create the params for the isinValueScraper
 * @param address - The address to scrape
 * @returns {Object} - The params for the isinValueScraper
 * @throws {Error} - If the value is not found or not a number or 0
*/
const cryptoWalletOptionsCreator = (address) => {
    const url = `https://etherscan.io/tokenholdings?a=${address}`
    const logger = (msg) => console.log(`cryptoWalletOptionsCreator - ${msg}`)
    const selector = 'HoldingsUSD'
    const selectorFunction = (selector) => {
        const rawValue = document.querySelector(selector).innerText
        const match = rawValue.match(/\d{1,3}(?:,\d{3})*(?:\.\d+)?(?=\sEUR)/);
        if (!match) throw new Error('Value not found');
        const numbericValue = parseFloat(match[0].replace(/,/g, ''));
        if (!numbericValue) throw new Error('Value not found');
        return numbericValue;
    }
    return {
        [address]: { url, selector, selectorFunction, logger }
    }
}

/**
 * Scrape the value of a crypto currency
 * @param address - The address to scrape
 * @returns {Promise<number>} - The value of the crypto currency
 * @throws {Error} - If the value is not found or not a number or 0
*/
const cryptoWalletValue = async (address) => {
    const params = cryptoWalletOptionsCreator(address)
    const { url, selector, selectorFunction, logger } = params[address]
    return core.urlSelectorScraper(url, selector, selectorFunction, logger)
}

module.exports = {
    cryptoWalletValue,
    cryptoWalletOptionsCreator,
}