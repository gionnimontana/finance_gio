const core = require('../core')

/**
 * Scrape the value of an isin
 * @param {string} validator - The crypto currency to scrape
 * @returns {Promise<number>} - The value of the crypto currency
 * @throws {Error} - If the value is not found or not a number or 0
*/
const validatorAdjustedBalanceScraper = async (validator) => {
    const URL = `https://beaconcha.in/validator/${validator}#attestations`
    const logger = (msg) => console.log(`validatorAdjustedBalance - ${msg}`)
    const SELECTOR = ".overview-container .m-3:nth-of-type(3) .d-flex span span"

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