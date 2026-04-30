/**
 * Provide shared Puppeteer scraping helpers with retries, provider fallbacks, cached values, and progress reporting.
 */
const fs = require('fs')
const os = require('os')
const path = require('path')
const puppeteer = require('puppeteer')

const TEST_MODE = process.env.PFB_TEST_MODE === '1'
const DEFAULT_TEST_PROGRESS_DELAY_MS = 20
const LOW_MEMORY_THRESHOLD_BYTES = Number(process.env.PFB_SCRAPER_LOW_MEMORY_THRESHOLD_BYTES || 3 * 1024 * 1024 * 1024)
const IS_LOW_MEMORY_MACHINE = os.totalmem() <= LOW_MEMORY_THRESHOLD_BYTES
const DEFAULT_CACHE_TTL_MS = Number(process.env.PFB_SCRAPER_CACHE_TTL_MS || 5 * 60 * 1000)
const DEFAULT_STALE_CACHE_TTL_MS = Number(process.env.PFB_SCRAPER_STALE_CACHE_TTL_MS || 12 * 60 * 60 * 1000)
const DEFAULT_NAVIGATION_TIMEOUT_MS = Number(process.env.PFB_SCRAPER_TIMEOUT_MS || (IS_LOW_MEMORY_MACHINE ? 12000 : 5000))
const DEFAULT_SELECTOR_TIMEOUT_MS = Number(process.env.PFB_SCRAPER_SELECTOR_TIMEOUT_MS || (IS_LOW_MEMORY_MACHINE ? 8000 : 3500))
const DEFAULT_CONCURRENCY = Math.max(1, Number(process.env.PFB_SCRAPER_CONCURRENCY || (IS_LOW_MEMORY_MACHINE ? 1 : 3)))
const DEFAULT_WAIT_UNTIL = 'domcontentloaded'
const BLOCKED_RESOURCE_TYPES = new Set(['image', 'media', 'font'])
const BLOCKED_URL_PATTERNS = [/google-analytics/i, /googletagmanager/i, /doubleclick/i, /facebook\.net/i]

const cacheEntries = new Map()

// Lock to prevent concurrent refresh passes.
let isScrapingInProgress = false
let scrapingPromise = null

/**
 * Pause execution for a small amount of time.
 * @param {number} ms - Delay in milliseconds.
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

/**
 * Normalize a numeric configuration value.
 * @param {unknown} value - Candidate numeric value.
 * @param {number} fallback - Default to use when value is invalid.
 * @returns {number}
 */
const toPositiveNumber = (value, fallback) => {
    const numericValue = Number(value)
    return Number.isFinite(numericValue) && numericValue > 0 ? numericValue : fallback
}

/**
 * Build the Puppeteer launch options shared across all scraper calls.
 * @returns {{ args: string[] }}
 */
const getBrowserLaunchOptions = () => ({
    args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--no-zygote',
        '--disable-background-networking',
        '--disable-background-timer-throttling',
        '--disable-renderer-backgrounding',
    ],
})

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
            progressDelayMs: toPositiveNumber(parsed?.progressDelayMs, DEFAULT_TEST_PROGRESS_DELAY_MS),
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
 * Normalize a selector candidate list.
 * @param {{ selector?: string, selectors?: string[] }} providerConfig - Raw provider config.
 * @returns {string[]}
 */
const normalizeSelectors = (providerConfig) => {
    if (Array.isArray(providerConfig.selectors)) {
        return providerConfig.selectors.filter(Boolean)
    }

    if (providerConfig.selector) {
        return [providerConfig.selector]
    }

    return []
}

/**
 * Normalize a provider config into the shared runtime contract.
 * @param {string} assetName - Asset cache key.
 * @param {object} providerConfig - Raw provider config.
 * @param {number} providerIndex - Position inside the provider chain.
 * @returns {{ name: string, url: string, selectors: string[], parseValue: Function, selectorArgMode: 'single'|'list', logger: Function, waitUntil: string, navigationTimeoutMs: number, selectorTimeoutMs: number, blockResources: boolean, waitForSelector: boolean }}
 */
const normalizeProviderConfig = (assetName, providerConfig, providerIndex) => {
    const selectors = normalizeSelectors(providerConfig)
    const parseValue = typeof providerConfig.parseValue === 'function'
        ? providerConfig.parseValue
        : providerConfig.selectorFunction

    if (typeof parseValue !== 'function') {
        throw new Error(`Invalid scraper provider for ${assetName}: missing parser function`)
    }

    if (typeof providerConfig.url !== 'string' || !providerConfig.url.trim()) {
        throw new Error(`Invalid scraper provider for ${assetName}: missing url`)
    }

    return {
        name: providerConfig.name || `${assetName}-provider-${providerIndex + 1}`,
        url: providerConfig.url,
        selectors,
        parseValue,
        selectorArgMode: typeof providerConfig.parseValue === 'function' ? 'list' : 'single',
        logger: typeof providerConfig.logger === 'function' ? providerConfig.logger : () => {},
        waitUntil: providerConfig.waitUntil || DEFAULT_WAIT_UNTIL,
        navigationTimeoutMs: toPositiveNumber(providerConfig.navigationTimeoutMs, DEFAULT_NAVIGATION_TIMEOUT_MS),
        selectorTimeoutMs: toPositiveNumber(providerConfig.selectorTimeoutMs, DEFAULT_SELECTOR_TIMEOUT_MS),
        blockResources: providerConfig.blockResources !== false,
        waitForSelector: providerConfig.waitForSelector !== false,
    }
}

/**
 * Normalize an option config into an ordered provider chain with cache settings.
 * @param {string} assetName - Asset cache key.
 * @param {object} optionConfig - Raw option config.
 * @returns {{ cacheTtlMs: number, staleCacheTtlMs: number, providers: ReturnType<typeof normalizeProviderConfig>[] }}
 */
const normalizeOptionConfig = (assetName, optionConfig) => {
    if (!optionConfig || typeof optionConfig !== 'object') {
        throw new Error(`Invalid scraper config for ${assetName}`)
    }

    const providerConfigs = Array.isArray(optionConfig.providers) ? optionConfig.providers : [optionConfig]
    if (!providerConfigs.length) {
        throw new Error(`Invalid scraper config for ${assetName}: no providers configured`)
    }

    return {
        cacheTtlMs: toPositiveNumber(optionConfig.cacheTtlMs, DEFAULT_CACHE_TTL_MS),
        staleCacheTtlMs: toPositiveNumber(optionConfig.staleCacheTtlMs || optionConfig.staleTtlMs, DEFAULT_STALE_CACHE_TTL_MS),
        providers: providerConfigs.map((providerConfig, providerIndex) => normalizeProviderConfig(assetName, providerConfig, providerIndex)),
    }
}

/**
 * Store a successful value in the shared cache.
 * @param {string} name - Asset cache key.
 * @param {number} value - Resolved numeric value.
 * @param {{ provider?: string|null, sourceUrl?: string|null }} [metadata={}] - Extra cache metadata.
 * @returns {{ value: number, updatedAt: number, provider: string|null, sourceUrl: string|null }}
 */
const writeCacheEntry = (name, value, metadata = {}) => {
    const entry = {
        value,
        updatedAt: Date.now(),
        provider: metadata.provider || null,
        sourceUrl: metadata.sourceUrl || null,
    }
    cacheEntries.set(name, entry)
    return entry
}

/**
 * Resolve a fresh cache hit when the entry is still within its TTL.
 * @param {string} name - Asset cache key.
 * @param {number} cacheTtlMs - Fresh-cache TTL.
 * @returns {{ value: number, updatedAt: number, provider: string|null, sourceUrl: string|null } | null}
 */
const getFreshCacheEntry = (name, cacheTtlMs) => {
    const entry = cacheEntries.get(name)
    if (!entry) return null
    return Date.now() - entry.updatedAt <= cacheTtlMs ? entry : null
}

/**
 * Resolve a stale-but-reusable cache entry for failure recovery.
 * @param {string} name - Asset cache key.
 * @param {number} staleCacheTtlMs - Stale-cache TTL.
 * @returns {{ value: number, updatedAt: number, provider: string|null, sourceUrl: string|null } | null}
 */
const getReusableCacheEntry = (name, staleCacheTtlMs) => {
    const entry = cacheEntries.get(name)
    if (!entry) return null
    return Date.now() - entry.updatedAt <= staleCacheTtlMs ? entry : null
}

/**
 * Build a plain object of cached values for the requested asset names.
 * @param {string[]} assetNames - Requested asset ids.
 * @returns {Record<string, number>}
 */
const getCachedValuesSnapshot = (assetNames) => assetNames.reduce((acc, assetName) => {
    const entry = cacheEntries.get(assetName)
    if (entry && Number.isFinite(entry.value)) {
        acc[assetName] = entry.value
    }
    return acc
}, {})

/**
 * Turn a low-level scrape error into a runtime classification.
 * @param {Error} error - Scrape failure.
 * @returns {{ reason: 'navigation'|'selector'|'parse'|'runtime', retryable: boolean, message: string }}
 */
const classifyScrapeError = (error) => {
    const message = error?.message || 'Unknown scraper error'

    if (/net::|navigation|timeout.*navigation|ERR_/i.test(message)) {
        return { reason: 'navigation', retryable: true, message }
    }

    if (/waiting failed|selector|queryselector/i.test(message)) {
        return { reason: 'selector', retryable: true, message }
    }

    if (/value not found|unable to parse|invalid numeric/i.test(message)) {
        return { reason: 'parse', retryable: false, message }
    }

    return { reason: 'runtime', retryable: true, message }
}

/**
 * Validate the numeric value returned by a provider parser.
 * @param {unknown} value - Candidate numeric value.
 * @returns {number}
 */
const normalizeScrapedValue = (value) => {
    const numericValue = Number(value)
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
        throw new Error('Value not found')
    }
    return numericValue
}

/**
 * Enable light request blocking for a scrape page.
 * @param {import('puppeteer').Page} page - Active Puppeteer page.
 * @param {{ blockResources: boolean, navigationTimeoutMs: number, selectorTimeoutMs: number }} provider - Normalized provider config.
 * @returns {Promise<void>}
 */
const configurePage = async (page, provider) => {
    page.setDefaultNavigationTimeout(provider.navigationTimeoutMs)
    page.setDefaultTimeout(provider.selectorTimeoutMs)

    if (!provider.blockResources) {
        return
    }

    await page.setRequestInterception(true)
    page.on('request', (request) => {
        const shouldBlock = BLOCKED_RESOURCE_TYPES.has(request.resourceType())
            || BLOCKED_URL_PATTERNS.some(pattern => pattern.test(request.url()))

        if (shouldBlock) {
            request.abort().catch(() => {})
            return
        }

        request.continue().catch(() => {})
    })
}

/**
 * Wait for any selector candidate configured for the provider.
 * @param {import('puppeteer').Page} page - Active Puppeteer page.
 * @param {{ selectors: string[], selectorTimeoutMs: number, waitForSelector: boolean }} provider - Normalized provider config.
 * @returns {Promise<void>}
 */
const waitForProviderSelectors = async (page, provider) => {
    if (!provider.waitForSelector || !provider.selectors.length) {
        return
    }

    await page.waitForFunction(
        (selectors) => selectors.some(selector => Boolean(document.querySelector(selector))),
        { timeout: provider.selectorTimeoutMs },
        provider.selectors
    )
}

/**
 * Execute a single provider attempt.
 * @param {import('puppeteer').Browser} browser - Shared Puppeteer browser instance.
 * @param {{ name: string, url: string, selectors: string[], parseValue: Function, selectorArgMode: 'single'|'list', logger: Function, waitUntil: string, navigationTimeoutMs: number, selectorTimeoutMs: number, blockResources: boolean, waitForSelector: boolean }} provider - Normalized provider config.
 * @returns {Promise<number>}
 */
const scrapeProviderAttempt = async (browser, provider) => {
    let page = null

    try {
        provider.logger(`Navigating to ${provider.url}...`)
        page = await browser.newPage()
        await configurePage(page, provider)
        await page.goto(provider.url, {
            waitUntil: provider.waitUntil,
            timeout: provider.navigationTimeoutMs,
        })

        provider.logger(`Collecting stats from ${provider.name}...`)
        await waitForProviderSelectors(page, provider)

        const selectorArg = provider.selectorArgMode === 'single'
            ? provider.selectors[0]
            : provider.selectors
        const value = await page.evaluate(provider.parseValue, selectorArg)
        const normalizedValue = normalizeScrapedValue(value)
        provider.logger(`Scrape done via ${provider.name}, scraped: ${normalizedValue}`)
        return normalizedValue
    } finally {
        if (page) {
            try {
                await page.close()
            } catch (closeError) {
                // Ignore cleanup failures.
            }
        }
    }
}

/**
 * Scrape a provider with bounded retries and classified failures.
 * @param {import('puppeteer').Browser} browser - Shared Puppeteer browser instance.
 * @param {string} assetName - Asset cache key.
 * @param {ReturnType<typeof normalizeProviderConfig>} provider - Normalized provider config.
 * @param {number} maxRetries - Maximum retry count per provider.
 * @returns {Promise<{ value: number|null, failed: boolean, provider: string, reason: 'navigation'|'selector'|'parse'|'runtime', message: string }>} 
 */
const scrapeProviderWithRetry = async (browser, assetName, provider, maxRetries) => {
    let lastFailure = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
            const value = await scrapeProviderAttempt(browser, provider)
            return {
                value,
                failed: false,
                provider: provider.name,
                reason: 'runtime',
                message: '',
            }
        } catch (error) {
            const failure = classifyScrapeError(error)
            lastFailure = failure
            provider.logger(`Attempt ${attempt + 1}/${maxRetries + 1} failed for ${assetName} via ${provider.name}: ${failure.message}`)

            if (attempt === maxRetries || !failure.retryable) {
                break
            }

            const backoffMs = Math.min(1500, 150 * (2 ** attempt) + Math.floor(Math.random() * 75))
            await sleep(backoffMs)
        }
    }

    provider.logger(`All retries exhausted for ${assetName} via ${provider.name}`)
    return {
        value: null,
        failed: true,
        provider: provider.name,
        reason: lastFailure?.reason || 'runtime',
        message: lastFailure?.message || 'Unknown scraper error',
    }
}

/**
 * Resolve a single asset value through its provider chain and stale cache fallback.
 * @param {import('puppeteer').Browser} browser - Shared Puppeteer browser instance.
 * @param {string} assetName - Asset cache key.
 * @param {{ cacheTtlMs: number, staleCacheTtlMs: number, providers: ReturnType<typeof normalizeProviderConfig>[] }} optionConfig - Normalized asset config.
 * @param {number} maxRetries - Maximum retry count per provider.
 * @param {boolean} refresh - Whether fresh cache should be bypassed.
 * @returns {Promise<{ value: number|null, failed: boolean, cached: boolean, stale: boolean, provider: string|null, reason: string|null }>} 
 */
const scrapeOptionWithFallback = async (browser, assetName, optionConfig, maxRetries, refresh) => {
    const freshEntry = getFreshCacheEntry(assetName, optionConfig.cacheTtlMs)
    if (!refresh && freshEntry) {
        return {
            value: freshEntry.value,
            failed: false,
            cached: true,
            stale: false,
            provider: freshEntry.provider,
            reason: null,
        }
    }

    const staleEntry = getReusableCacheEntry(assetName, optionConfig.staleCacheTtlMs)
    let lastFailure = null

    for (const provider of optionConfig.providers) {
        const providerResult = await scrapeProviderWithRetry(browser, assetName, provider, maxRetries)
        if (!providerResult.failed && providerResult.value !== null) {
            writeCacheEntry(assetName, providerResult.value, {
                provider: providerResult.provider,
                sourceUrl: provider.url,
            })

            return {
                value: providerResult.value,
                failed: false,
                cached: false,
                stale: false,
                provider: providerResult.provider,
                reason: null,
            }
        }

        lastFailure = providerResult
    }

    if (staleEntry) {
        console.warn(`Scraper fallback to stale cache for ${assetName} after live providers failed; last provider=${lastFailure?.provider || 'unknown'} reason=${lastFailure?.reason || 'unknown'}`)
        return {
            value: staleEntry.value,
            failed: false,
            cached: true,
            stale: true,
            provider: staleEntry.provider,
            reason: lastFailure?.reason || 'stale-cache',
        }
    }

    return {
        value: null,
        failed: true,
        cached: false,
        stale: false,
        provider: lastFailure?.provider || null,
        reason: lastFailure?.reason || 'runtime',
    }
}

/**
 * Scrape one asset value directly through the normalized option contract.
 * @param {string} assetName - Asset cache key.
 * @param {object} optionConfig - Raw or normalized scraper config.
 * @param {number} [maxRetries=0] - Maximum retry count per provider.
 * @returns {Promise<number>}
 */
const optionValueScraper = async (assetName, optionConfig, maxRetries = 0) => {
    const browser = await puppeteer.launch(getBrowserLaunchOptions())

    try {
        const normalizedOptionConfig = normalizeOptionConfig(assetName, optionConfig)
        const result = await scrapeOptionWithFallback(browser, assetName, normalizedOptionConfig, maxRetries, true)
        if (result.failed || result.value === null) {
            throw new Error(`Scraper failed for ${assetName}`)
        }
        return result.value
    } finally {
        try {
            await browser.close()
        } catch (closeError) {
            // Ignore cleanup failures.
        }
    }
}

/**
 * Scrape a legacy single-provider config directly.
 * @param {string} url - The url to scrape.
 * @param {string} selector - The selector to scrape.
 * @param {Function} selectorFunction - The parser function executed in the page context.
 * @param {Function} logger - Logger used by the scraper.
 * @returns {Promise<number>}
 */
const urlSelectorScraper = async (url, selector, selectorFunction, logger) => optionValueScraper(url, {
    providers: [{
        name: 'legacy-provider',
        url,
        selector,
        selectorFunction,
        logger,
    }],
})

/**
 * Emit a normalized progress event.
 * @param {(progressData: { name: string, value: number|null, failed: boolean, index: number, total: number, cached?: boolean, stale?: boolean, provider?: string|null, reason?: string|null }) => void | null} onProgress - Optional progress callback.
 * @param {{ name: string, value: number|null, failed: boolean, cached: boolean, stale: boolean, provider: string|null, reason: string|null }} result - Runtime scrape result.
 * @param {number} index - Completed asset count.
 * @param {number} total - Total asset count.
 * @returns {void}
 */
const emitProgress = (onProgress, result, index, total) => {
    if (!onProgress) {
        return
    }

    onProgress({
        name: result.name,
        value: result.value,
        failed: result.failed,
        index,
        total,
        cached: result.cached,
        stale: result.stale,
        provider: result.provider,
        reason: result.reason,
    })
}

/**
 * Execute a list of async jobs with a bounded worker pool.
 * @template T
 * @param {T[]} items - Jobs to process.
 * @param {number} concurrency - Maximum number of concurrent workers.
 * @param {(item: T) => Promise<void>} worker - Worker callback.
 * @returns {Promise<void>}
 */
const runWithConcurrency = async (items, concurrency, worker) => {
    let nextIndex = 0
    const workerCount = Math.min(concurrency, items.length)

    const workers = Array.from({ length: workerCount }, async () => {
        while (nextIndex < items.length) {
            const currentIndex = nextIndex
            nextIndex += 1
            await worker(items[currentIndex])
        }
    })

    await Promise.all(workers)
}

/**
 * Deterministic scraper implementation used during end-to-end tests.
 * @param {Array<{ name: object }>} options - Scraper option configs.
 * @param {boolean} refresh - Whether cached values should be refreshed.
 * @param {(progressData: { name: string, value: number|null, failed: boolean, index: number, total: number, cached?: boolean, stale?: boolean, provider?: string|null, reason?: string|null }) => void | null} [onProgress=null] - Optional progress callback.
 * @returns {Promise<{values: Record<string, number>, failures: string[]}>}
 */
const runDeterministicTestScraper = async (options, refresh, onProgress = null) => {
    if (isScrapingInProgress && scrapingPromise) {
        return scrapingPromise
    }

    isScrapingInProgress = true
    scrapingPromise = (async () => {
        const fixture = readTestFixture()
        const configuredFailures = new Set(fixture.failures)
        const assetNames = options.map(option => Object.keys(option)[0])
        const totalAssets = options.length
        const failures = new Set()
        let completedCount = 0

        try {
            for (const option of options) {
                const [name, rawOptionConfig] = Object.entries(option)[0]
                const optionConfig = normalizeOptionConfig(name, rawOptionConfig)
                const freshEntry = getFreshCacheEntry(name, optionConfig.cacheTtlMs)

                if (!refresh && freshEntry && !configuredFailures.has(name)) {
                    completedCount += 1
                    emitProgress(onProgress, {
                        name,
                        value: freshEntry.value,
                        failed: false,
                        cached: true,
                        stale: false,
                        provider: freshEntry.provider || 'deterministic-fixture',
                        reason: null,
                    }, completedCount, totalAssets)
                    continue
                }

                await sleep(fixture.progressDelayMs)

                const staleEntry = getReusableCacheEntry(name, optionConfig.staleCacheTtlMs)
                const shouldFail = configuredFailures.has(name) || !hasFixtureValue(fixture.values, name)
                let result = null

                if (!shouldFail) {
                    const value = normalizeScrapedValue(fixture.values[name])
                    writeCacheEntry(name, value, { provider: 'deterministic-fixture' })
                    result = {
                        name,
                        value,
                        failed: false,
                        cached: false,
                        stale: false,
                        provider: 'deterministic-fixture',
                        reason: null,
                    }
                } else if (staleEntry) {
                    result = {
                        name,
                        value: staleEntry.value,
                        failed: false,
                        cached: true,
                        stale: true,
                        provider: staleEntry.provider || 'deterministic-fixture',
                        reason: 'stale-cache',
                    }
                } else {
                    failures.add(name)
                    result = {
                        name,
                        value: null,
                        failed: true,
                        cached: false,
                        stale: false,
                        provider: null,
                        reason: 'fixture-failure',
                    }
                }

                completedCount += 1
                emitProgress(onProgress, result, completedCount, totalAssets)
            }

            return {
                values: getCachedValuesSnapshot(assetNames),
                failures: [...failures],
            }
        } finally {
            isScrapingInProgress = false
            scrapingPromise = null
        }
    })()

    return scrapingPromise
}

/**
 * Scrape multiple assets with provider fallback, bounded concurrency, and cache reuse.
 * @param {Array<{ name: object }>} options - The options to scrape.
 * @param {number} [maxRetries=2] - Maximum retry count per provider.
 * @param {boolean} refresh - Whether to bypass fresh cache entries.
 * @param {(progressData: { name: string, value: number|null, failed: boolean, index: number, total: number, cached?: boolean, stale?: boolean, provider?: string|null, reason?: string|null }) => void | null} [onProgress=null] - Optional progress callback.
 * @returns {Promise<{values: Record<string, number>, failures: string[]}>}
 */
const multipleUrlSelectorScraper = async (options, maxRetries = 2, refresh, onProgress = null) => {
    if (TEST_MODE) {
        return runDeterministicTestScraper(options, refresh, onProgress)
    }

    if (isScrapingInProgress && scrapingPromise) {
        console.log('Scraping already in progress, waiting for completion...')
        return scrapingPromise
    }

    isScrapingInProgress = true
    scrapingPromise = (async () => {
        const browser = await puppeteer.launch(getBrowserLaunchOptions())
        const normalizedOptions = options.map((option) => {
            const [name, rawOptionConfig] = Object.entries(option)[0]
            return {
                name,
                optionConfig: normalizeOptionConfig(name, rawOptionConfig),
            }
        })
        const totalAssets = normalizedOptions.length
        const failures = new Set()
        const pendingOptions = []
        let completedCount = 0

        try {
            for (const entry of normalizedOptions) {
                const freshEntry = getFreshCacheEntry(entry.name, entry.optionConfig.cacheTtlMs)
                if (!refresh && freshEntry) {
                    completedCount += 1
                    emitProgress(onProgress, {
                        name: entry.name,
                        value: freshEntry.value,
                        failed: false,
                        cached: true,
                        stale: false,
                        provider: freshEntry.provider,
                        reason: null,
                    }, completedCount, totalAssets)
                    continue
                }

                pendingOptions.push(entry)
            }

            await runWithConcurrency(pendingOptions, DEFAULT_CONCURRENCY, async (entry) => {
                const result = await scrapeOptionWithFallback(browser, entry.name, entry.optionConfig, maxRetries, refresh)
                if (result.failed) {
                    failures.add(entry.name)
                    console.warn(`Scraper failed for ${entry.name}`)
                }

                completedCount += 1
                emitProgress(onProgress, {
                    ...result,
                    name: entry.name,
                }, completedCount, totalAssets)
            })

            return {
                values: getCachedValuesSnapshot(normalizedOptions.map(entry => entry.name)),
                failures: [...failures],
            }
        } catch (error) {
            console.error('multipleUrlSelectorScraper - unexpected error:', error.message)
            return {
                values: getCachedValuesSnapshot(normalizedOptions.map(entry => entry.name)),
                failures: [...failures],
            }
        } finally {
            try {
                await browser.close()
            } catch (closeError) {
                // Ignore cleanup failures.
            }
            isScrapingInProgress = false
            scrapingPromise = null
        }
    })()

    return scrapingPromise
}

/**
 * Reset shared runtime state for deterministic tests.
 * @returns {void}
 */
const resetScraperState = () => {
    cacheEntries.clear()
    isScrapingInProgress = false
    scrapingPromise = null
}

module.exports = {
    urlSelectorScraper,
    optionValueScraper,
    multipleUrlSelectorScraper,
    resetScraperState,
}