/**
 * Scrape ETF quote data from justETF using the shared browser helpers.
 */
const core = require('../core')
const fetchImpl = global.fetch || require('cross-fetch')

/**
 * Parse the justETF quote payload into a numeric quote.
 * @param {unknown} payload - JSON payload returned by the justETF quote API.
 * @returns {number}
 */
const parseJustEtfQuotePayload = (payload) => {
    const numericValue = Number(payload?.latestQuote?.raw)
    if (Number.isFinite(numericValue) && numericValue > 0) {
        return numericValue
    }

    throw new Error('Value not found')
}

/**
 * Create an abort signal when the current runtime supports timeout-based signals.
 * @param {number} timeoutMs - Timeout in milliseconds.
 * @returns {AbortSignal|undefined}
 */
const createTimeoutSignal = (timeoutMs) => {
    if (typeof AbortSignal === 'undefined' || typeof AbortSignal.timeout !== 'function') {
        return undefined
    }

    return AbortSignal.timeout(timeoutMs)
}

/**
 * Build a justETF provider config for an ETF quote.
 * @param {string} isin - The ISIN to scrape.
 * @returns {{ name: string, url: string, selectors: string[], parseValue: Function, logger: Function, waitUntil: string, navigationTimeoutMs: number, selectorTimeoutMs: number, waitForSelector: boolean, blockResources: boolean }}
 */
const createJustEtfProvider = (isin) => {
    const url = `https://www.justetf.com/api/etfs/${isin}/quote?locale=en&currency=EUR&isin=${isin}`
    const navigationTimeoutMs = Number(process.env.PFB_SCRAPER_ETF_TIMEOUT_MS || 14000)
    /**
     * Log scraping progress for the current ETF lookup.
     * @param {string} msg - Message to print.
     * @returns {void}
     */
    const logger = (msg) => console.log(`isinValueScraper - ${msg}`)
    const selectors = ['body']
    /**
     * Parse the justETF quote API response into a numeric value.
     * @param {string[]} _selectorCandidates - Unused selector list kept for shared-provider compatibility.
     * @returns {number}
     */
    const parseValue = (_selectorCandidates) => {
        const payloadText = document.body?.innerText || ''
        const payload = JSON.parse(payloadText)
        const numericValue = Number(payload?.latestQuote?.raw)
        if (Number.isFinite(numericValue) && numericValue > 0) {
            return numericValue
        }

        throw new Error('Value not found')
    }
    /**
     * Fetch the justETF quote API directly instead of waiting on the rendered quote shell.
     * @returns {Promise<number>}
     */
    const fetchValue = async () => {
        const response = await fetchImpl(url, {
            headers: {
                Accept: 'application/json',
                'Accept-Language': 'en-US,en;q=0.9',
                'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36',
            },
            signal: createTimeoutSignal(navigationTimeoutMs),
        })

        if (!response.ok) {
            throw new Error(`Request failed with status ${response.status}`)
        }

        const payload = await response.json()
        return parseJustEtfQuotePayload(payload)
    }

    return {
        name: 'justetf',
        url,
        selectors,
        fetchValue,
        parseValue,
        logger,
        waitUntil: 'domcontentloaded',
        navigationTimeoutMs,
        selectorTimeoutMs: Number(process.env.PFB_SCRAPER_ETF_SELECTOR_TIMEOUT_MS || 9000),
        waitForSelector: false,
        blockResources: false,
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