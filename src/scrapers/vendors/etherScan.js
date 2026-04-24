/**
 * Build wallet-holdings scrapers for Etherscan using the shared browser utilities.
 */
const core = require('../core')

/**
 * Create the scraping config needed to resolve a wallet value from Etherscan.
 * @param {string} address - The address to scrape.
 * @returns {Object<string, { url: string, selector: string, selectorFunction: Function, logger: Function }>} - Scraper options keyed by wallet address.
 * @throws {Error} - If the value is not found or not a number or 0
*/
const cryptoWalletOptionsCreator = (address) => {
    const url = `https://etherscan.io/tokenholdings?a=${address}`
    /**
     * Log scraping progress for the current wallet lookup.
     * @param {string} msg - Message to print.
     * @returns {void}
     */
    const logger = (msg) => console.log(`cryptoWalletOptionsCreator - ${msg}`)
    const selector = 'HoldingsUSD'
    /**
     * Parse the EUR wallet value from the selected Etherscan element.
     * @param {string} selector - CSS selector for the holdings element.
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
        [address]: { url, selector, selectorFunction, logger }
    }
}

/**
 * Scrape the total EUR value for an on-chain wallet.
 * @param {string} address - The address to scrape.
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