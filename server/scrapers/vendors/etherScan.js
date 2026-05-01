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
    const selectors = [
        '#HoldingsUSD',
        '[id="HoldingsUSD"]',
        '[data-testid="HoldingsUSD"]',
        '.card-body .fw-medium',
    ]
    /**
     * Parse the wallet value from the selected Etherscan element.
     * @param {string[]} selectorCandidates - CSS selectors to try in order.
     * @returns {number}
     */
    const parseValue = (selectorCandidates) => {
        const parseNumericText = (text) => {
            if (!text) return null
            const match = text.replace(/\u00a0/g, ' ').match(/([\d.,\s]+)(?=\s*(?:USD|EUR)|$)/i)
            if (!match) return null
            const raw = match[1].replace(/\s/g, '')
            let normalized = raw

            if (raw.includes(',') && raw.includes('.')) {
                normalized = raw.lastIndexOf('.') > raw.lastIndexOf(',')
                    ? raw.replace(/,/g, '')
                    : raw.replace(/\./g, '').replace(',', '.')
            } else if (raw.includes(',')) {
                const decimalDigits = raw.split(',').pop()?.length || 0
                normalized = decimalDigits === 2 ? raw.replace(/\./g, '').replace(',', '.') : raw.replace(/,/g, '')
            }

            const numericValue = Number(normalized)
            return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null
        }

        for (const selector of selectorCandidates) {
            const element = document.querySelector(selector)
            const numericValue = parseNumericText(element?.textContent || '')
            if (numericValue !== null) {
                return numericValue
            }
        }

        throw new Error('Value not found')
    }

    return {
        [address]: {
            providers: [{
                name: 'etherscan',
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
 * Scrape the total EUR value for an on-chain wallet.
 * @param {string} address - The address to scrape.
 * @returns {Promise<number>} - The value of the crypto currency
 * @throws {Error} - If the value is not found or not a number or 0
*/
const cryptoWalletValue = async (address) => {
    const params = cryptoWalletOptionsCreator(address)
    return core.optionValueScraper(address, params[address], 1)
}

module.exports = {
    cryptoWalletValue,
    cryptoWalletOptionsCreator,
}