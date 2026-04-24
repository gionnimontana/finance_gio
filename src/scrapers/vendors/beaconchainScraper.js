/**
 * Scrape Ethereum validator balances from beaconcha.in using the shared browser helpers.
 */
const core = require('../core')

/**
 * Scrape a validator adjusted balance from beaconcha.in.
 * @param {string} validator - The crypto currency to scrape
 * @returns {Promise<number>} - The value of the crypto currency
 * @throws {Error} - If the value is not found or not a number or 0
*/
const validatorAdjustedBalanceScraper = async (validator) => {
    const URL = `https://beaconcha.in/validator/${validator}#attestations`
    /**
     * Log scraping progress for the current validator lookup.
     * @param {string} msg - Message to print.
     * @returns {void}
     */
    const logger = (msg) => console.log(`validatorAdjustedBalance - ${msg}`)
    const SELECTOR = ".overview-container .m-3:nth-of-type(3) .d-flex span span"

    /**
     * Parse the validator balance text into a numeric ETH amount.
     * @param {string} selector - CSS selector for the balance element.
     * @returns {number|null}
     */
    const selectorFunction = (selector) => {
        const rawValue = document.querySelector(selector).innerText
        const match = rawValue.match(/(\d+(\.\d+)?)(?=\s*ETH)/);
        return match ? parseFloat(match[0]) : null;
    }

    return core.urlSelectorScraper(URL, SELECTOR, selectorFunction, logger)
}

module.exports = {
    validatorAdjustedBalanceScraper,
}