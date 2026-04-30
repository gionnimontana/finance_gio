/**
 * Scrape crypto-to-EUR quotes from Yahoo Finance using the shared browser helpers.
 */
const core = require('../core')

/**
 * Build a Yahoo Finance provider config for a crypto quote.
 * @param {'BTC' | 'ETH' } crypto - The crypto currency to scrape.
 * @returns {{ name: string, url: string, selectors: string[], parseValue: Function, logger: Function, waitUntil: string, navigationTimeoutMs: number, selectorTimeoutMs: number }}
 */
const createYahooFinanceProvider = (crypto) => {
    const url = `https://it.finance.yahoo.com/quote/${crypto}-EUR/`
    /**
     * Log scraping progress for the current Yahoo Finance lookup.
     * @param {string} msg - Message to print.
     * @returns {void}
     */
    const logger = (msg) => console.log(`yahooFinanceScraper - ${msg}`)
    const selectors = [
        '[data-testid="qsp-price"]',
        'main [data-testid="qsp-price"]',
    ]
    /**
     * Parse the quoted EUR price from the Yahoo Finance page.
     * @param {string[]} selectorCandidates - CSS selectors to try in order.
     * @returns {number}
     */
    const parseValue = (selectorCandidates) => {
        const parseNumericText = (text) => {
            if (!text) return null
            const match = text.replace(/\u00a0/g, ' ').match(/([\d.,\s]+)/)
            if (!match) return null
            const raw = match[1].replace(/\s/g, '')
            let normalized = raw

            if (raw.includes(',') && raw.includes('.')) {
                normalized = raw.lastIndexOf('.') > raw.lastIndexOf(',')
                    ? raw.replace(/,/g, '')
                    : raw.replace(/\./g, '').replace(',', '.')
            } else if (raw.includes(',')) {
                normalized = raw.replace(/\./g, '').replace(',', '.')
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
        name: 'yahoo-finance',
        url,
        selectors,
        parseValue,
        logger,
        waitUntil: 'domcontentloaded',
        navigationTimeoutMs: 4500,
        selectorTimeoutMs: 3000,
    }
}

/**
 * Create the scraping config needed to resolve a crypto price from Yahoo Finance.
 * @param {'BTC' | 'ETH' } crypto - The crypto currency to scrape
 * @returns {Object<string, { url: string, selector: string, selectorFunction: Function, logger: Function }>} - Scraper options keyed by ticker.
 * @throws {Error} - If the value is not found or not a number or 0
*/
const cryptoOptionsCreator = (crypto) => {
    return {
        [crypto]: {
            providers: [createYahooFinanceProvider(crypto)],
        }
    }
}

/**
 * Scrape a crypto-to-EUR rate from Yahoo Finance.
 * @param {'BTC' | 'ETH' } crypto - The crypto currency to scrape
 * @returns {Promise<number>} - The value of the crypto currency
 * @throws {Error} - If the value is not found or not a number or 0
*/
const cryptoValue = async (crypto) => {
    const params = cryptoOptionsCreator(crypto)
    return core.optionValueScraper(crypto, params[crypto], 1)
}

module.exports = {
    cryptoValue: cryptoValue,
    cryptoOptionsCreator,
    createYahooFinanceProvider,
}