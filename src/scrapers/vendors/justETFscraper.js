/**
 * Scrape ETF quote data from justETF using the shared browser helpers.
 */
const core = require('../core')

/**
 * Build a justETF provider config for an ETF quote.
 * @param {string} isin - The ISIN to scrape.
 * @returns {{ name: string, url: string, selectors: string[], parseValue: Function, logger: Function, waitUntil: string, navigationTimeoutMs: number, selectorTimeoutMs: number }}
 */
const createJustEtfProvider = (isin) => {
    const url = `https://www.justetf.com/en/etf-profile.html?isin=${isin}#overview`
    /**
     * Log scraping progress for the current ETF lookup.
     * @param {string} msg - Message to print.
     * @returns {void}
     */
    const logger = (msg) => console.log(`isinValueScraper - ${msg}`)
    const selectors = [
        '[data-testid="realtime-quote"]',
        '#realtime-quotes [class*="price"]',
        '#realtime-quotes span:nth-child(2)',
        '#realtime-quotes > div > div > div > div > span:nth-child(2)',
    ]
    /**
     * Parse the ETF quote text into a numeric value.
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
                normalized = raw.lastIndexOf(',') > raw.lastIndexOf('.')
                    ? raw.replace(/\./g, '').replace(',', '.')
                    : raw.replace(/,/g, '')
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
        name: 'justetf',
        url,
        selectors,
        parseValue,
        logger,
        waitUntil: 'domcontentloaded',
        navigationTimeoutMs: 5000,
        selectorTimeoutMs: 3500,
    }
}

/**
 * Create the scraping config needed to resolve an ETF quote by ISIN.
 * @param {string} isin - The isin to scrape
 * @returns {Object<string, { url: string, selector: string, selectorFunction: Function, logger: Function }>} - Scraper options keyed by ISIN.
 * @throws {Error} - If the value is not found or not a number or 0
*/
const isinOptionCreator = (isin) => {
    return {
        [isin]: {
            providers: [createJustEtfProvider(isin)],
        }
    }
}

/**
 * Scrape the quote value for an ETF identified by ISIN.
 * @param {string} isin - The ISIN to scrape
 * @returns {Promise<number>} - The current ETF quote
 * @throws {Error} - If the value is not found or not a number or 0
*/
const isinValueScraper = async (isin) => {
    const params = isinOptionCreator(isin)
    return core.optionValueScraper(isin, params[isin], 1)
}

module.exports = {
    isinValue: isinValueScraper,
    isinOptionCreator,
    createJustEtfProvider,
}