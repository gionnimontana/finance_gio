/**
 * Scrape justETF quote data and KID-derived ISIN risk indicators through the shared fetch-first runtime.
 */
const { PDFParse } = require('pdf-parse')

const core = require('../core')

const JUST_ETF_BASE_URL = 'https://www.justetf.com'
const JUST_ETF_USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/135.0.0.0 Safari/537.36'
const ISIN_RISK_CACHE_KEY_PREFIX = 'isin-risk:'
const ISIN_RISK_CACHE_TTL_MS = 24 * 60 * 60 * 1000
const KNOWN_DIRECT_ISSUER_KID_URLS = {
    GB00BJYDH287: {
        issuerHost: 'wisdomtree.eu',
        url: 'https://dataspanapi.wisdomtree.com/pdr/documents/PRIIP_KID/WIXL/GB/EN-GB/GB00BJYDH287/',
    },
}

/**
 * Normalize a candidate ISIN into the shared uppercase representation.
 * @param {string} isin - Candidate ISIN.
 * @returns {string}
 */
const normalizeIsin = (isin) => String(isin || '').trim().toUpperCase()

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
 * Return the common HTTP headers used for justETF and issuer KID fetches.
 * @returns {{ Accept: string, 'Accept-Language': string, 'User-Agent': string }}
 */
const createRequestHeaders = () => ({
    Accept: 'application/json, text/html, application/pdf;q=0.9, */*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9',
    'User-Agent': JUST_ETF_USER_AGENT,
})

/**
 * Fetch a remote resource and throw when the response is not successful.
 * @param {string} url - The URL to fetch.
 * @param {number} timeoutMs - Timeout in milliseconds.
 * @param {string} accept - Preferred Accept header value.
 * @returns {Promise<Response>}
 */
const fetchWithTimeout = async (url, timeoutMs, accept) => {
    if (typeof fetch !== 'function') {
        throw new Error('Global fetch is unavailable. Use Node 24.15.0 or newer.')
    }

    const response = await fetch(url, {
        headers: {
            ...createRequestHeaders(),
            Accept: accept,
        },
        signal: createTimeoutSignal(timeoutMs),
    })

    if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`)
    }

    return response
}

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
 * Extract anchor href/text pairs from an HTML string.
 * @param {string} html - Raw HTML to inspect.
 * @returns {{ href: string, text: string }[]}
 */
const extractAnchors = (html) => {
    const anchors = []
    const anchorPattern = /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi
    let match = anchorPattern.exec(String(html || ''))

    while (match) {
        anchors.push({
            href: match[1],
            text: match[2].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim(),
        })
        match = anchorPattern.exec(String(html || ''))
    }

    return anchors
}

/**
 * Convert a relative or absolute link into an absolute URL.
 * @param {string} href - Raw href attribute.
 * @returns {string}
 */
const toAbsoluteUrl = (href) => new URL(href, JUST_ETF_BASE_URL).toString()

/**
 * Extract the issuer-hosted profile page linked from justETF.
 * @param {string} html - HTML returned by justETF.
 * @returns {string}
 */
const extractIssuerProfileUrl = (html) => {
    const anchors = extractAnchors(html)
    const preferredAnchor = anchors.find(({ href, text }) => {
        const normalizedHref = href.toLowerCase()
        return /^https?:\/\//i.test(href)
            && !normalizedHref.startsWith(JUST_ETF_BASE_URL)
            && /(etf\s*profile|issuer)/i.test(text)
    })

    if (preferredAnchor) {
        return preferredAnchor.href
    }

    const fallbackAnchor = anchors.find(({ href }) => {
        const normalizedHref = href.toLowerCase()
        return /^https?:\/\//i.test(href)
            && !normalizedHref.startsWith(JUST_ETF_BASE_URL)
            && !/\.pdf(?:[?#]|$)/i.test(href)
    })

    if (fallbackAnchor) {
        return fallbackAnchor.href
    }

    throw new Error('Issuer profile URL not found')
}

/**
 * Resolve a direct issuer-hosted KID URL for products whose public issuer page blocks server-side fetches.
 * @param {string} isin - Requested ISIN.
 * @param {string} issuerProfileUrl - Issuer profile URL discovered on justETF.
 * @returns {string|null}
 */
const buildKnownDirectIssuerKidUrl = (isin, issuerProfileUrl) => {
    const normalizedIsin = normalizeIsin(isin)
    const knownEntry = KNOWN_DIRECT_ISSUER_KID_URLS[normalizedIsin]
    if (!knownEntry) {
        return null
    }

    const issuerHost = new URL(issuerProfileUrl).hostname.replace(/^www\./i, '').toLowerCase()
    if (issuerHost !== knownEntry.issuerHost) {
        return null
    }

    return knownEntry.url
}

/**
 * Resolve whether a link is a supported KID document candidate for the requested ISIN.
 * @param {{ href: string, text: string }} anchor - Candidate link.
 * @param {string} normalizedIsin - Requested ISIN in uppercase form.
 * @returns {boolean}
 */
const isMatchingKidDocumentLink = (anchor, normalizedIsin) => {
    const normalizedHref = anchor.href.toUpperCase()
    const isMatchingIsin = normalizedHref.includes(normalizedIsin)

    if (!isMatchingIsin) {
        return false
    }

    return /\/PRP_[^"']+\.PDF(?:\?[^"']*)?$/i.test(anchor.href)
        || /\/PRIIP_KID\//i.test(anchor.href)
        || /\b(KID|PRIIP)\b/i.test(anchor.text)
}

/**
 * Extract the KID document URL for the requested ISIN from a justETF or issuer page.
 * @param {string} html - HTML returned by justETF or the issuer site.
 * @param {string} isin - Requested ISIN.
 * @returns {string}
 */
const extractKidDocumentUrl = (html, isin) => {
    const normalizedIsin = normalizeIsin(isin)
    const matchingAnchor = extractAnchors(html).find(anchor => isMatchingKidDocumentLink(anchor, normalizedIsin))

    if (!matchingAnchor) {
        throw new Error(`KID document not found for ${normalizedIsin}`)
    }

    return toAbsoluteUrl(matchingAnchor.href)
}

/**
 * Extract the synthetic risk indicator from KID text.
 * @param {string} text - Extracted PDF text.
 * @returns {number}
 */
const extractSyntheticRiskIndicator = (text) => {
    const normalizedText = String(text || '').replace(/\s+/g, ' ').trim()
    const patterns = [
        /classified\s+this\s+product\s+as\s+(\d)\s+out\s+of\s+7/i,
        /summary\s+risk\s+indicator[^\d]{0,120}(\d)\s+out\s+of\s+7/i,
        /abbiamo\s+classificato\s+questo\s+prodotto\s+al\s+livello\s+(\d)\s+su\s+7/i,
        /indicatore\s+sintetico\s+di\s+rischio[^\d]{0,120}(\d)\s+su\s+7/i,
    ]

    for (const pattern of patterns) {
        const match = normalizedText.match(pattern)
        const numericValue = Number(match?.[1])
        if (Number.isInteger(numericValue) && numericValue >= 1 && numericValue <= 7) {
            return numericValue
        }
    }

    throw new Error('Synthetic risk indicator not found')
}

/**
 * Parse a downloaded PDF buffer into text.
 * @param {Buffer} pdfBuffer - Downloaded PDF payload.
 * @returns {Promise<string>}
 */
const extractPdfText = async (pdfBuffer) => {
    const parser = new PDFParse({ data: pdfBuffer })
    const result = await parser.getText()

    if (typeof parser.destroy === 'function') {
        await parser.destroy()
    }

    return result?.text || ''
}

/**
 * Fetch an HTML page as text.
 * @param {string} url - Page URL.
 * @param {number} timeoutMs - Timeout in milliseconds.
 * @returns {Promise<string>}
 */
const fetchHtmlPage = async (url, timeoutMs) => {
    const response = await fetchWithTimeout(url, timeoutMs, 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8')
    return response.text()
}

/**
 * Fetch the justETF ETF details page for the requested ISIN.
 * @param {string} isin - Requested ISIN.
 * @param {number} timeoutMs - Timeout in milliseconds.
 * @returns {Promise<string>}
 */
const fetchJustEtfDetailsPage = async (isin, timeoutMs) => {
    const normalizedIsin = normalizeIsin(isin)
    const url = `${JUST_ETF_BASE_URL}/en/etf-profile.html?isin=${encodeURIComponent(normalizedIsin)}`
    return fetchHtmlPage(url, timeoutMs)
}

/**
 * Resolve the most relevant KID document URL for an ISIN.
 * @param {string} isin - Requested ISIN.
 * @param {number} timeoutMs - Timeout in milliseconds.
 * @returns {Promise<string>}
 */
const resolveKidDocumentUrl = async (isin, timeoutMs) => {
    const detailsHtml = await fetchJustEtfDetailsPage(isin, timeoutMs)

    try {
        return extractKidDocumentUrl(detailsHtml, isin)
    } catch (error) {
        const issuerProfileUrl = extractIssuerProfileUrl(detailsHtml)
        const directIssuerKidUrl = buildKnownDirectIssuerKidUrl(isin, issuerProfileUrl)
        if (directIssuerKidUrl) {
            return directIssuerKidUrl
        }
        const issuerHtml = await fetchHtmlPage(issuerProfileUrl, timeoutMs)
        return extractKidDocumentUrl(issuerHtml, isin)
    }
}

/**
 * Fetch and parse the KID PDF text for the requested ISIN.
 * @param {string} isin - Requested ISIN.
 * @param {number} timeoutMs - Timeout in milliseconds.
 * @returns {Promise<string>}
 */
const fetchKidPdfText = async (isin, timeoutMs) => {
    const kidUrl = await resolveKidDocumentUrl(isin, timeoutMs)
    const response = await fetchWithTimeout(kidUrl, timeoutMs, 'application/pdf,*/*;q=0.8')
    const pdfBuffer = Buffer.from(await response.arrayBuffer())
    return extractPdfText(pdfBuffer)
}

/**
 * Build a justETF provider config for an ETF quote.
 * @param {string} isin - The ISIN to scrape.
 * @returns {{ name: string, url: string, selectors: string[], fetchValue: Function, parseValue: Function, logger: Function, waitUntil: string, navigationTimeoutMs: number, selectorTimeoutMs: number, waitForSelector: boolean, blockResources: boolean }}
 */
const createJustEtfProvider = (isin) => {
    const normalizedIsin = normalizeIsin(isin)
    const url = `${JUST_ETF_BASE_URL}/api/etfs/${normalizedIsin}/quote?locale=en&currency=EUR&isin=${normalizedIsin}`
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
        const response = await fetchWithTimeout(url, navigationTimeoutMs, 'application/json')
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
 * Build the isolated cache key used for the persistent ISIN risk path.
 * @param {string} isin - Requested ISIN.
 * @returns {string}
 */
const buildIsinRiskCacheKey = (isin) => `${ISIN_RISK_CACHE_KEY_PREFIX}${normalizeIsin(isin)}`

/**
 * Build a fetch-only provider config for an ISIN KID risk indicator.
 * @param {string} isin - Requested ISIN.
 * @returns {{ name: string, url: string, selectors: string[], fetchValue: Function, parseValue: Function, logger: Function, waitUntil: string, navigationTimeoutMs: number, selectorTimeoutMs: number, waitForSelector: boolean, blockResources: boolean }}
 */
const createIsinRiskProvider = (isin) => {
    const normalizedIsin = normalizeIsin(isin)
    const navigationTimeoutMs = Number(process.env.PFB_SCRAPER_ETF_TIMEOUT_MS || 14000)
    const url = `${JUST_ETF_BASE_URL}/en/etf-profile.html?isin=${encodeURIComponent(normalizedIsin)}`
    /**
     * Log scraping progress for the current ISIN risk lookup.
     * @param {string} msg - Message to print.
     * @returns {void}
     */
    const logger = (msg) => console.log(`isinRiskScraper - ${msg}`)
    /**
     * Keep a parser function on the provider contract even though the live path fetches directly.
     * @returns {number}
     */
    const parseValue = () => {
        throw new Error('Value not found')
    }
    /**
     * Fetch the ETF page plus its linked KID PDF and parse the PRIIPs risk class.
     * @returns {Promise<number>}
     */
    const fetchValue = async () => {
        const pdfText = await fetchKidPdfText(normalizedIsin, navigationTimeoutMs)
        return extractSyntheticRiskIndicator(pdfText)
    }

    return {
        name: 'justetf-kid',
        url,
        selectors: ['body'],
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
 * @param {string} isin - The ISIN to scrape.
 * @returns {Object<string, { providers: object[] }>}
 */
const isinOptionCreator = (isin) => {
    const normalizedIsin = normalizeIsin(isin)

    return {
        [normalizedIsin]: {
            providers: [createJustEtfProvider(normalizedIsin)],
        },
    }
}

/**
 * Create the scraping config needed to resolve an ISIN synthetic risk indicator.
 * @param {string} isin - The ISIN to resolve.
 * @returns {Object<string, { cacheTtlMs: number, providers: object[] }>}
 */
const isinRiskOptionCreator = (isin) => {
    const normalizedIsin = normalizeIsin(isin)
    const cacheKey = buildIsinRiskCacheKey(normalizedIsin)

    return {
        [cacheKey]: {
            cacheTtlMs: ISIN_RISK_CACHE_TTL_MS,
            providers: [createIsinRiskProvider(normalizedIsin)],
        },
    }
}

/**
 * Scrape the quote value for an ETF identified by ISIN.
 * @param {string} isin - The ISIN to scrape.
 * @returns {Promise<number>}
 */
const isinValueScraper = async (isin) => {
    const normalizedIsin = normalizeIsin(isin)
    const params = isinOptionCreator(normalizedIsin)
    return core.optionValueScraper(normalizedIsin, params[normalizedIsin], 1)
}

module.exports = {
    isinValue: isinValueScraper,
    isinOptionCreator,
    isinRiskOptionCreator,
    buildIsinRiskCacheKey,
    createJustEtfProvider,
    createIsinRiskProvider,
    buildKnownDirectIssuerKidUrl,
    extractIssuerProfileUrl,
    extractKidDocumentUrl,
    extractSyntheticRiskIndicator,
    parseJustEtfQuotePayload,
}
