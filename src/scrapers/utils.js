const puppeteer = require('puppeteer')

/**
 * Scrape the value of an isin
 * @param {string} url - The url to scrape
 * @param {string} selector - The selector to scrape
 * @param {function} selectorFunction - The function to scrape the selector
 * @param {function} logger - The logger function
 * @returns {Promise<number>} - The value of the crypto currency
 * @throws {Error} - If the value is not found or not a number or 0
*/
const urlSelectorScraper = async (url, selector, selectorFunction, logger) => {
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })
    
    logger(`Navigating to ${url}...`)
    const page = await browser.newPage()
    await page.goto(url, { waitUntil: 'load' })

    logger(`Collecting the stats...`)
    await page.waitForSelector(selector)

    const value = await page.evaluate(selectorFunction, selector);
    if (value === 0 || undefined) throw new Error('Value not found')

    logger('Closing page...')
    await page.close()

    logger('Closing the browser...')
    await browser.close()

    logger(`Scrape done, scraped: ${value}`)
    return value
}

/**
 * Scrape the value of multiple urls
 * @param {Array<{ name: { url: string, selector: string, selectorFunction: function, logger: function}}>} options - The options to scrape
 * @param {number} maxRetries - The number of max retries on failure
 * @returns {Promise<{string: number}>} - The values of the selectors
 * @throws {Error} - If the value is not found or not a number or 0
 */
const multipleUrlSelectorScraper = async (options, maxRetries = 0) => {
    const browser = await puppeteer.launch({
        args: ['--no-sandbox', '--disable-setuid-sandbox'],
    })

    const values = {}

    try {

    for (const option of options) {
        const name = Object.keys(option)[0]
        const { url, selector, selectorFunction, logger } = option[name]

        logger(`Navigating to ${url}...`)
        const page = await browser.newPage()
        await page.goto(url, { waitUntil: 'load' })

        logger(`Collecting the stats...`)
        await page.waitForSelector(selector)

        const value = await page.evaluate(selectorFunction, selector);
        if (value === 0 || undefined) throw new Error('Value not found')

        logger('Closing page...')
        await page.close()

        values[name] = value
    }

    await browser.close()

    return values

    } catch (error) {
        if (maxRetries === 0) {
            await browser.close()
            throw error
        }
        await browser.close()
        return multipleUrlSelectorScraper(options, maxRetries - 1)
    }
}

module.exports = {
    urlSelectorScraper: urlSelectorScraper,
    multipleUrlSelectorScraper: multipleUrlSelectorScraper
}