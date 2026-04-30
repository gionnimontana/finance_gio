/**
 * Scrape Ethereum validator balances from beaconcha.in using the shared browser helpers.
 */
const core = require('../core')

/**
 * Create the scraping config needed to resolve a validator balance.
 * @param {string} validator - Validator id.
 * @returns {Object<string, { providers: object[] }>}
 */
const validatorAdjustedBalanceOptionsCreator = (validator) => {
    const url = `https://beaconcha.in/validator/${validator}#attestations`
    /**
     * Log scraping progress for the current validator lookup.
     * @param {string} msg - Message to print.
     * @returns {void}
     */
    const logger = (msg) => console.log(`validatorAdjustedBalance - ${msg}`)
    const selectors = [
        '[data-testid="validator-balance"]',
        '.overview-container .m-3:nth-of-type(3) .d-flex span span',
        '.overview-container .d-flex span span',
    ]
    /**
     * Parse the validator balance text into a numeric ETH amount.
     * @param {string[]} selectorCandidates - CSS selectors to try in order.
     * @returns {number}
     */
    const parseValue = (selectorCandidates) => {
        for (const selector of selectorCandidates) {
            const element = document.querySelector(selector)
            const rawValue = element?.textContent || ''
            const match = rawValue.match(/(\d+(?:[.,]\d+)?)(?=\s*ETH)/)
            if (!match) continue
            const numericValue = Number(match[1].replace(',', '.'))
            if (Number.isFinite(numericValue) && numericValue > 0) {
                return numericValue
            }
        }

        throw new Error('Value not found')
    }

    return {
        [validator]: {
            providers: [{
                name: 'beaconchain',
                url,
                selectors,
                parseValue,
                logger,
                waitUntil: 'domcontentloaded',
                navigationTimeoutMs: 5000,
                selectorTimeoutMs: 3500,
            }],
        }
    }
}

/**
 * Scrape a validator adjusted balance from beaconcha.in.
 * @param {string} validator - The crypto currency to scrape
 * @returns {Promise<number>} - The value of the crypto currency
 * @throws {Error} - If the value is not found or not a number or 0
*/
const validatorAdjustedBalanceScraper = async (validator) => {
    const params = validatorAdjustedBalanceOptionsCreator(validator)
    return core.optionValueScraper(validator, params[validator], 1)
}

module.exports = {
    validatorAdjustedBalanceScraper,
    validatorAdjustedBalanceOptionsCreator,
}