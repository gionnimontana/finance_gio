/**
 * Resolve crypto-to-EUR quotes from Yahoo Finance through the chart API first, with page parsing as a fallback.
 */
const core = require('../core')

const YAHOO_FINANCE_PAGE_BASE_URL = 'https://it.finance.yahoo.com/quote'
const YAHOO_FINANCE_CHART_BASE_URL = 'https://query1.finance.yahoo.com/v8/finance/chart'
const YAHOO_FINANCE_API_TIMEOUT_MS = Number(process.env.PFB_SCRAPER_CRYPTO_API_TIMEOUT_MS || 2500)

/**
 * Build the Yahoo Finance quote page URL for a crypto asset.
 * @param {string} crypto - Crypto symbol.
 * @returns {string}
 */
const getYahooFinancePageUrl = (crypto) => `${YAHOO_FINANCE_PAGE_BASE_URL}/${crypto}-EUR/`

/**
 * Build the Yahoo Finance chart API URL for a crypto asset.
 * @param {string} crypto - Crypto symbol.
 * @returns {string}
 */
const getYahooFinanceChartUrl = (crypto) => `${YAHOO_FINANCE_CHART_BASE_URL}/${crypto}-EUR?interval=1d&range=1d`

/**
 * Parse the quoted EUR price from the Yahoo Finance page.
 * @param {string[]} selectorCandidates - CSS selectors to try in order.
 * @returns {number}
 */
const parseYahooFinancePageValue = (selectorCandidates) => {
    const parseYahooFinanceNumericText = (text) => {
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
        const numericValue = parseYahooFinanceNumericText(element?.textContent || '')
        if (numericValue !== null) {
            return numericValue
        }
    }

    throw new Error('Value not found')
}

/**
 * Extract a quote from the Yahoo Finance chart API payload.
 * @param {unknown} payload - Parsed JSON response.
 * @returns {number}
 */
const extractYahooFinanceChartPrice = (payload) => {
    const chartResult = payload?.chart?.result?.[0]
    const directPrice = Number(chartResult?.meta?.regularMarketPrice)
    if (Number.isFinite(directPrice) && directPrice > 0) {
        return directPrice
    }

    const closes = chartResult?.indicators?.quote?.[0]?.close
    if (Array.isArray(closes)) {
        for (let index = closes.length - 1; index >= 0; index -= 1) {
            const candidate = Number(closes[index])
            if (Number.isFinite(candidate) && candidate > 0) {
                return candidate
            }
        }
    }

    throw new Error('Value not found')
}

/**
 * Fetch the latest Yahoo Finance crypto quote through the chart API.
 * @param {string} crypto - Crypto symbol.
 * @param {typeof fetch} [fetchImpl=fetch] - Fetch implementation for tests.
 * @returns {Promise<number>}
 */
const fetchYahooFinanceChartPrice = async (crypto, fetchImpl = fetch) => {
    const response = await fetchImpl(getYahooFinanceChartUrl(crypto), {
        headers: {
            Accept: 'application/json',
        },
        signal: AbortSignal.timeout(YAHOO_FINANCE_API_TIMEOUT_MS),
    })

    if (!response.ok) {
        throw new Error(`Yahoo Finance API request failed with status ${response.status}`)
    }

    const payload = await response.json()
    return extractYahooFinanceChartPrice(payload)
}

/**
 * Build the fetch-first Yahoo Finance provider config for a crypto quote.
 * @param {string} crypto - The crypto currency to scrape.
 * @returns {{ name: string, url: string, selectors: string[], fetchValue: Function, parseValue: Function, logger: Function, waitUntil: string, navigationTimeoutMs: number, selectorTimeoutMs: number, blockResources: boolean, waitForSelector: boolean }}
 */
const createYahooFinanceProvider = (crypto) => {
    const url = getYahooFinanceChartUrl(crypto)
    /**
     * Log scraping progress for the current Yahoo Finance lookup.
     * @param {string} msg - Message to print.
     * @returns {void}
     */
    const logger = (msg) => console.log(`yahooFinanceScraper - ${msg}`)

    return {
        name: 'yahoo-finance-api',
        url,
        selectors: ['body'],
        fetchValue: () => fetchYahooFinanceChartPrice(crypto),
        parseValue: () => {
            throw new Error('Value not found')
        },
        logger,
        waitUntil: 'domcontentloaded',
        navigationTimeoutMs: 2500,
        selectorTimeoutMs: 1000,
        blockResources: false,
        waitForSelector: false,
    }
}

/**
 * Build the Yahoo Finance page provider config for browser-backed fallback parsing.
 * @param {string} crypto - The crypto currency to scrape.
 * @returns {{ name: string, url: string, selectors: string[], parseValue: Function, logger: Function, waitUntil: string, navigationTimeoutMs: number, selectorTimeoutMs: number }}
 */
const createYahooFinancePageProvider = (crypto) => {
    const url = getYahooFinancePageUrl(crypto)
    const logger = (msg) => console.log(`yahooFinanceScraper - ${msg}`)
    const selectors = [
        '[data-testid="qsp-price"]',
        'main [data-testid="qsp-price"]',
    ]

    return {
        name: 'yahoo-finance-page',
        url,
        selectors,
        parseValue: parseYahooFinancePageValue,
        logger,
        waitUntil: 'domcontentloaded',
        navigationTimeoutMs: 4500,
        selectorTimeoutMs: 3000,
    }
}

/**
 * Create the scraping config needed to resolve a crypto price from Yahoo Finance.
 * @param {string} crypto - The crypto currency to scrape
 * @returns {Object<string, { url: string, selector: string, selectorFunction: Function, logger: Function }>} - Scraper options keyed by ticker.
 * @throws {Error} - If the value is not found or not a number or 0
*/
const cryptoOptionsCreator = (crypto) => {
    return {
        [crypto]: {
            providers: [
                createYahooFinanceProvider(crypto),
                createYahooFinancePageProvider(crypto),
            ],
        }
    }
}

/**
 * Scrape a crypto-to-EUR rate from Yahoo Finance.
 * @param {string} crypto - The crypto currency to scrape
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
    createYahooFinancePageProvider,
    extractYahooFinanceChartPrice,
    fetchYahooFinanceChartPrice,
}