/**
 * Provide shared Puppeteer scraping helpers with retries, cached values, and progress reporting.
 */
const fs = require('fs')
const path = require('path')
const puppeteer = require('puppeteer')

const TEST_MODE = process.env.PFB_TEST_MODE === '1'
const DEFAULT_TEST_PROGRESS_DELAY_MS = 20

/**
 * Pause execution for a small amount of time.
 * @param {number} ms - Delay in milliseconds.
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Read the configured deterministic scraper fixture for test mode.
 * @returns {{ values: Record<string, number>, failures: string[], progressDelayMs: number }}
 */
const readTestFixture = () => {
    const fixturePath = process.env.PFB_TEST_FIXTURE_PATH
    if (!fixturePath) {
        return { values: {}, failures: [], progressDelayMs: DEFAULT_TEST_PROGRESS_DELAY_MS }
    }

    try {
        const raw = fs.readFileSync(path.resolve(fixturePath), 'utf8')
        const parsed = JSON.parse(raw)
        return {
            values: parsed && typeof parsed.values === 'object' ? parsed.values : {},
            failures: Array.isArray(parsed?.failures) ? parsed.failures : [],
            progressDelayMs: Number(parsed?.progressDelayMs || DEFAULT_TEST_PROGRESS_DELAY_MS),
        }
    } catch (error) {
        console.error(`Failed to read scraper test fixture: ${error.message}`)
        return { values: {}, failures: [], progressDelayMs: DEFAULT_TEST_PROGRESS_DELAY_MS }
    }
}

/**
 * Resolve whether a fixture value exists for a scraper key.
 * @param {Record<string, number>} fixtureValues - Deterministic values keyed by scraper name.
 * @param {string} name - Scraper cache key.
 * @returns {boolean}
 */
const hasFixtureValue = (fixtureValues, name) => Object.prototype.hasOwnProperty.call(fixtureValues, name)

/**
 * Deterministic scraper implementation used during end-to-end tests.
 * @param {Array<{ name: { url: string, selector: string, selectorFunction: function, logger: function}}>} options - Scraper option configs.
 * @param {boolean} refresh - Whether cached values should be refreshed.
 * @param {(progressData: { name: string, value: number|null, failed: boolean, index: number, total: number, cached?: boolean }) => void | null} [onProgress=null] - Optional progress callback.
 * @returns {Promise<{values: {string: number}, failures: string[]}>}
 */
const runDeterministicTestScraper = async (options, refresh, onProgress = null) => {
    if (isScrapingInProgress && scrapingPromise) {
        return scrapingPromise
    }

    isScrapingInProgress = true
    scrapingPromise = (async () => {
        const fixture = readTestFixture()
        const totalAssets = options.length
        const configuredFailures = new Set(fixture.failures)

        if (refresh) {
            failures.length = 0
        }

        try {
            for (let index = 0; index < totalAssets; index++) {
                const option = options[index]
                const name = Object.keys(option)[0]
                const currentIndex = index + 1

                if (!refresh && hasFixtureValue(values, name) && !configuredFailures.has(name)) {
                    if (onProgress) {
                        onProgress({ name, value: values[name], failed: false, index: currentIndex, total: totalAssets, cached: true })
                    }
                    continue
                }

                await sleep(fixture.progressDelayMs)

                const failed = configuredFailures.has(name) || !hasFixtureValue(fixture.values, name)
                if (!failed) {
                    values[name] = Number(fixture.values[name])
                    const failureIndex = failures.indexOf(name)
                    if (failureIndex > -1) failures.splice(failureIndex, 1)
                } else if (!failures.includes(name)) {
                    failures.push(name)
                }

                if (onProgress) {
                    onProgress({
                        name,
                        value: hasFixtureValue(values, name) ? values[name] : null,
                        failed,
                        index: currentIndex,
                        total: totalAssets,
                        cached: false,
                    })
                }
            }

            return { values: { ...values }, failures: [...failures] }
        } finally {
            isScrapingInProgress = false
            scrapingPromise = null
        }
    })()

    return scrapingPromise
}

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
        args: [
            '--no-sandbox', 
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-gpu',
        ],
    })
    
    logger(`Navigating to ${url}...`)
    const page = await browser.newPage()
    await page.goto(url, { waitUntil: 'load' })

    logger(`Collecting the stats...`)
    await page.waitForSelector(selector, { timeout: 5000 })

    const value = await page.evaluate(selectorFunction, selector);
    if (value === 0 || undefined) throw new Error('Value not found')

    logger('Closing page...')
    await page.close()

    logger('Closing the browser...')
    await browser.close()

    logger(`Scrape done, scraped: ${value}`)
    return value
}

const values = {}
const failures = []

/**
 * Scrape a single option with retry logic
 * @param {Object} browser - The puppeteer browser instance
 * @param {string} name - The name of the asset
 * @param {Object} optionConfig - The scraper config { url, selector, selectorFunction, logger }
 * @param {number} maxRetries - The number of max retries on failure
 * @returns {Promise<{value: number|null, failed: boolean}>} - The scraped value and failure status
 */
const scrapeWithRetry = async (browser, name, optionConfig, maxRetries = 5) => {
    const { url, selector, selectorFunction, logger } = optionConfig
    let page = null
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            logger(`Navigating to ${url}...`)
            page = await browser.newPage()
            await page.goto(url, { waitUntil: 'load' })

            logger(`Collecting the stats...`)
            await page.waitForSelector(selector, { timeout: 5000 })

            const value = await page.evaluate(selectorFunction, selector)
            if (value === 0 || value === undefined) throw new Error('Value not found')

            logger('Closing page...')
            await page.close()
            page = null

            logger(`Scrape done, scraped: ${value}`)
            return { value, failed: false }
        } catch (error) {
            // Always close the page on error
            if (page) {
                try {
                    await page.close()
                } catch (closeError) {
                    // Ignore close errors
                }
                page = null
            }
            logger(`Attempt ${attempt + 1}/${maxRetries + 1} failed: ${error.message}`)
            if (attempt === maxRetries) {
                logger(`All retries exhausted for ${name}`)
                return { value: null, failed: true }
            }
        }
    }
    return { value: null, failed: true }
}

// Lock to prevent concurrent scraping
let isScrapingInProgress = false
let scrapingPromise = null

/**
 * Scrape the value of multiple urls
 * @param {Array<{ name: { url: string, selector: string, selectorFunction: function, logger: function}}>} options - The options to scrape
 * @param {number} maxRetries - The number of max retries on failure per scraper
 * @param {boolean} refresh - Whether to refresh cached values
 * @param {function} onProgress - Optional callback called after each asset is scraped: onProgress({ name, value, failed, index, total })
 * @returns {Promise<{values: {string: number}, failures: string[]}>} - The values and list of failed scrapers
 */
const multipleUrlSelectorScraper = async (options, maxRetries = 5, refresh, onProgress = null) => {
    if (TEST_MODE) {
        return runDeterministicTestScraper(options, refresh, onProgress)
    }

    // If scraping is already in progress, wait for it to complete
    if (isScrapingInProgress && scrapingPromise) {
        console.log('Scraping already in progress, waiting for completion...')
        return scrapingPromise
    }

    isScrapingInProgress = true
    scrapingPromise = (async () => {
        const browser = await puppeteer.launch({
            args: [
                '--no-sandbox', 
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
            ],
        })

        // Clear previous failures on refresh
        if (refresh) {
            failures.length = 0
        }

        const totalAssets = options.length
        let currentIndex = 0

        try {
            for (const option of options) {
                const name = Object.keys(option)[0]
                currentIndex++

                // Skip if we already have a cached value and not refreshing
                if (!refresh && values[name]) {
                    // Still emit progress for cached values
                    if (onProgress) {
                        onProgress({ name, value: values[name], failed: false, index: currentIndex, total: totalAssets, cached: true })
                    }
                    continue
                }

                const optionConfig = option[name]
                const result = await scrapeWithRetry(browser, name, optionConfig, maxRetries)

                if (!result.failed && result.value !== null) {
                    values[name] = result.value
                    // Remove from failures if it was previously failing
                    const failureIndex = failures.indexOf(name)
                    if (failureIndex > -1) failures.splice(failureIndex, 1)
                } else if (result.failed) {
                    if (values[name]) {
                        // Keep the last known value if scraping failed
                        console.log(`Using cached value for ${name}: ${values[name]}`)
                    }
                    // Track the failure
                    if (!failures.includes(name)) {
                        failures.push(name)
                    }
                    console.warn(`Scraper failed for ${name}`)
                }

                // Emit progress after each asset is scraped
                if (onProgress) {
                    onProgress({ 
                        name, 
                        value: values[name] || null, 
                        failed: result.failed, 
                        index: currentIndex, 
                        total: totalAssets,
                        cached: false
                    })
                }
            }

            await browser.close()
            return { values, failures: [...failures] }

        } catch (error) {
            await browser.close()
            console.error('multipleUrlSelectorScraper - unexpected error:', error.message)
            return { values, failures: [...failures] }
        } finally {
            isScrapingInProgress = false
            scrapingPromise = null
        }
    })()

    return scrapingPromise
}

module.exports = {
    urlSelectorScraper: urlSelectorScraper,
    multipleUrlSelectorScraper: multipleUrlSelectorScraper
}