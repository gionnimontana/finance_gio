/**
 * Scrape spot gold prices from goldpreis.de using the shared browser helpers.
 */
const core = require('../core')

/**
 * Build a goldpreis.de provider config for the spot gold quote.
 * @returns {{ name: string, url: string, selectors: string[], parseValue: Function, logger: Function, waitUntil: string, navigationTimeoutMs: number, selectorTimeoutMs: number }}
 */
const createGoldPreisProvider = () => {
    const url = 'https://www.goldpreis.de/'
    /**
     * Log scraping progress for the gold price lookup.
     * @param {string} msg - Message to print.
     * @returns {void}
     */
    const logger = (msg) => console.log(`goldPriceScraper - ${msg}`)
    const selectors = ['table', '#content table', '.table']
    /**
     * Parse the price-per-gram entry from the tables returned by the page.
     * @param {string[]} selectorCandidates - CSS selectors to try in order.
     * @returns {number}
     */
    const parseValue = (selectorCandidates) => {
        const parseNumericText = (text) => {
            if (!text) return null
            const match = text.match(/([\d.,]+)\s*EUR/i)
            if (!match) return null
            const raw = match[1]
            const normalized = raw.includes(',')
                ? raw.replace(/\./g, '').replace(',', '.')
                : raw.replace(/,/g, '')
            const numericValue = Number(normalized)
            return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : null
        }

        for (const selector of selectorCandidates) {
            const tables = document.querySelectorAll(selector)
            for (const table of tables) {
                const rows = table.querySelectorAll('tr')
                for (const row of rows) {
                    const cells = row.querySelectorAll('td')
                    if (cells.length < 2) continue

                    const label = cells[0]?.textContent?.trim() || ''
                    if (!label.includes('1 Gramm') && !label.includes('1 g')) {
                        continue
                    }

                    const priceText = cells[cells.length - 1]?.textContent?.trim() || ''
                    const numericValue = parseNumericText(priceText)
                    if (numericValue !== null) {
                        return numericValue
                    }
                }
            }
        }

        throw new Error('Value not found')
    }

    return {
        name: 'goldpreis',
        url,
        selectors,
        parseValue,
        logger,
        waitUntil: 'domcontentloaded',
        navigationTimeoutMs: Number(process.env.PFB_SCRAPER_GOLD_TIMEOUT_MS || 10000),
        selectorTimeoutMs: Number(process.env.PFB_SCRAPER_GOLD_SELECTOR_TIMEOUT_MS || 7000),
    }
}

/**
 * Create the scraping config needed to resolve the gold price per gram in EUR.
 * @returns {Object<string, { url: string, selector: string, selectorFunction: Function, logger: Function }>} - Scraper options keyed by asset id.
 * @throws {Error} - If the value is not found or not a number or 0
 */
const goldOptionsCreator = () => {
    return {
        ['physical-gold']: {
            providers: [createGoldPreisProvider()],
        }
    }
}

/**
 * Scrape the current gold price per gram in EUR.
 * @returns {Promise<number>} - The value of gold per gram in EUR
 * @throws {Error} - If the value is not found or not a number or 0
 */
const goldValue = async () => {
    const params = goldOptionsCreator()
    return core.optionValueScraper('physical-gold', params['physical-gold'], 1)
}

module.exports = {
    goldValue,
    goldOptionsCreator,
    createGoldPreisProvider,
}
