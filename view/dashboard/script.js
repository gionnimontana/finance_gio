/**
 * Render the dashboard portfolio overview, manage refresh progress, and keep cached frontend state in sync.
 */

// Require authentication
if (!requireAuth()) {
    throw new Error('Not authenticated');
}

// Progress state
let previousAssetValues = {}; // Map of assetId -> previous total value
let runningDelta = 0; // Accumulated delta from individual asset changes
let progressAssetItems = []; // Streamed assets shown in the progress banner
const PORTFOLIO_CACHE_KEY = 'portfolio';
const SUCCESSFUL_PORTFOLIO_CACHE_KEY = 'portfolioLastSuccessfulSnapshot';
const LAST_UPDATE_KEY = 'portfolioLastUpdate';
const PROGRESS_BANNER_KEY = 'portfolioProgressBanner';
const DASHBOARD_TITLE_BASE = '🕵️‍♂️ Billy Tracker';
const PARTIAL_REFRESH_BANNER_TITLE = '⚠️ Partial Refresh Complete';
let currentAssetRiskState = { values: {}, failures: [], errorMessage: '' };
let currentAssetRiskRequest = 0;
const PORTFOLIO_META_KEYS = new Set([
    'total',
    'prevMonthTotal',
    'initYearNetworth',
    'schemaCacheKey',
    'allTimeHighTotal',
    'allTimeHighLabel',
    'failures',
    'viewGroups'
]);

/**
 * Read a JSON value from browser storage.
 * @param {string} key - Storage entry name.
 * @returns {object|null}
 */
const readStoredJson = (key) => {
    try {
        const raw = localStorage.getItem(key);
        return raw ? JSON.parse(raw) : null;
    } catch (e) {
        return null;
    }
};

/**
 * Persist a JSON value into browser storage.
 * @param {string} key - Storage entry name.
 * @param {object|null} value - Serializable payload.
 * @returns {void}
 */
const writeStoredJson = (key, value) => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
        // ignore
    }
};

/**
 * Remove one browser-storage entry.
 * @param {string} key - Storage entry name.
 * @returns {void}
 */
const removeStoredItem = (key) => {
    try {
        localStorage.removeItem(key);
    } catch (e) {
        // ignore
    }
};

/**
 * Determine whether a portfolio payload still contains failed assets.
 * @param {{ failures?: string[] }|null|undefined} portfolio - Portfolio payload.
 * @returns {boolean}
 */
const hasPortfolioFailures = (portfolio) => Array.isArray(portfolio?.failures) && portfolio.failures.length > 0;

/**
 * Read one persisted dashboard portfolio snapshot from browser storage.
 * @param {string} [key=PORTFOLIO_CACHE_KEY] - Snapshot storage key.
 * @returns {object|null}
 */
const readPortfolioSnapshot = (key = PORTFOLIO_CACHE_KEY) => readStoredJson(key);

/**
 * Persist one dashboard portfolio snapshot in browser storage.
 * @param {string} key - Snapshot storage key.
 * @param {object|null} portfolio - Portfolio payload to persist.
 * @returns {void}
 */
const writePortfolioSnapshot = (key, portfolio) => {
    if (!portfolio || typeof portfolio !== 'object') return;
    writeStoredJson(key, portfolio);
};

/**
 * Resolve the diff baseline used by refresh progress across reloads.
 * @param {object|null} cachedPortfolio - Latest visible cached portfolio.
 * @returns {object|null}
 */
const getRefreshBaselinePortfolio = (cachedPortfolio) => {
    const successfulPortfolio = readPortfolioSnapshot(SUCCESSFUL_PORTFOLIO_CACHE_KEY);
    if (!successfulPortfolio || typeof successfulPortfolio !== 'object') {
        if (cachedPortfolio && typeof cachedPortfolio === 'object') {
            writePortfolioSnapshot(SUCCESSFUL_PORTFOLIO_CACHE_KEY, cachedPortfolio);
        }
        return cachedPortfolio;
    }

    const successfulSchemaKey = successfulPortfolio.schemaCacheKey;
    const cachedSchemaKey = cachedPortfolio?.schemaCacheKey;
    if (successfulSchemaKey && cachedSchemaKey && successfulSchemaKey !== cachedSchemaKey) {
        removeStoredItem(SUCCESSFUL_PORTFOLIO_CACHE_KEY);
        if (cachedPortfolio && typeof cachedPortfolio === 'object') {
            writePortfolioSnapshot(SUCCESSFUL_PORTFOLIO_CACHE_KEY, cachedPortfolio);
        }
        return cachedPortfolio;
    }

    return successfulPortfolio;
};

/**
 * Advance the last-successful-refresh baseline after a fully successful load.
 * @param {object|null} portfolio - Portfolio payload to store as the new baseline.
 * @returns {void}
 */
const markSuccessfulPortfolioSnapshot = (portfolio) => {
    if (!portfolio || typeof portfolio !== 'object' || hasPortfolioFailures(portfolio)) return;
    writePortfolioSnapshot(SUCCESSFUL_PORTFOLIO_CACHE_KEY, portfolio);
    setLastUpdateNow();
};

/**
 * Toggle indeterminate progress-bar animation for non-streaming loads.
 * @param {boolean} active - Whether the loading animation should run.
 * @returns {void}
 */
const setProgressBarIndeterminate = (active) => {
    const progressBar = document.getElementById('progress_bar');
    progressBar.classList.toggle('indeterminate', active);
    if (active) {
        progressBar.style.width = '35%';
    }
};

/**
 * Reset and reveal the refresh progress banner.
 * @returns {void}
 */
const resetProgressBanner = () => {
    const banner = document.getElementById('progress_banner');
    banner.classList.add('visible');
    banner.classList.remove('completed');
    document.getElementById('error_banner').classList.remove('visible');
    setProgressBarIndeterminate(false);
    document.getElementById('progress_bar').style.width = '0%';
    document.getElementById('progress_counter').textContent = '0/0';
    document.getElementById('progress_assets_list').innerHTML = '';
    document.getElementById('progress_delta').textContent = '';
    document.getElementById('progress_delta').className = 'progress_delta';
    document.getElementById('progress_close').style.display = 'none';
    runningDelta = 0; // Reset running delta
    progressAssetItems = [];
};

/**
 * Reset and reveal the refresh progress banner.
 * @returns {void}
 */
const showProgressBanner = (title = '🔄 Refreshing Portfolio...') => {
    resetProgressBanner();
    document.getElementById('progress_title').textContent = title;
};

/**
 * Show the progress banner in loading mode while uncached data is being fetched.
 * @param {{ title?: string, message?: string }} [options] - Loading-banner copy overrides.
 * @returns {void}
 */
const showLoadingProgressBanner = (options = {}) => {
    const {
        title = '🔄 Loading Portfolio...',
        message = 'Fetching the latest portfolio data...'
    } = options;

    resetProgressBanner();
    setProgressBarIndeterminate(true);
    document.getElementById('progress_title').textContent = title;
    document.getElementById('progress_counter').textContent = 'Loading...';
    document.getElementById('progress_assets_list').innerHTML = `<div class="progress_status_message">${escapeHtml(message)}</div>`;
};

/**
 * Hide the refresh progress banner.
 * @returns {void}
 */
const hideProgressBanner = () => {
    const banner = document.getElementById('progress_banner');
    banner.classList.remove('visible');
    banner.classList.remove('completed');
    setProgressBarIndeterminate(false);
};

/**
 * Remove any persisted progress-banner state from localStorage.
 * @returns {void}
 */
const clearProgressBannerState = () => {
    try {
        localStorage.removeItem(PROGRESS_BANNER_KEY);
    } catch (e) {
        // ignore
    }
};

/**
 * Close the progress banner while leaving the last-update summary intact.
 * @returns {void}
 */
const closeProgressBanner = () => {
    hideProgressBanner();
    clearProgressBannerState();
};

/**
 * Format the progress-banner title from the stored last-update timestamp.
 * @returns {string}
 */
const formatProgressBannerTitle = () => {
    const raw = localStorage.getItem(LAST_UPDATE_KEY);
    if (!raw) return '✅ Refresh Complete';
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return '✅ Refresh Complete';
    return `✅ Updated: ${date.toLocaleString()}`;
};

/**
 * Mark the progress banner as completed and optionally persist its visible state.
 * @param {boolean} [persistState=true] - Whether the completed banner should survive reloads.
 * @param {string|null} [titleOverride=null] - Optional banner title override.
 * @returns {void}
 */
const completeProgressBanner = (persistState = true, titleOverride = null) => {
    const banner = document.getElementById('progress_banner');
    banner.classList.add('completed');
    setProgressBarIndeterminate(false);
    document.getElementById('progress_bar').style.width = '100%';
    document.getElementById('progress_title').textContent = titleOverride || formatProgressBannerTitle();
    document.getElementById('progress_close').style.display = 'block';
    
    if (persistState) {
        // Save progress banner state for persistence across page refresh
        saveProgressBannerState();
    } else {
        clearProgressBannerState();
    }
};

/**
 * Persist the current progress-banner markup so it survives reloads.
 * @returns {void}
 */
const saveProgressBannerState = () => {
    try {
        const state = {
            title: document.getElementById('progress_title').textContent,
            assetsListHtml: document.getElementById('progress_assets_list').innerHTML,
            deltaHtml: document.getElementById('progress_delta').innerHTML,
            deltaClass: document.getElementById('progress_delta').className,
            counter: document.getElementById('progress_counter').textContent
        };
        localStorage.setItem(PROGRESS_BANNER_KEY, JSON.stringify(state));
    } catch (e) {
        // ignore
    }
};

/**
 * Restore a previously completed progress banner from localStorage.
 * @returns {boolean}
 */
const restoreProgressBanner = () => {
    try {
        const raw = localStorage.getItem(PROGRESS_BANNER_KEY);
        if (!raw) return false;
        
        const state = JSON.parse(raw);
        if (!state || !state.assetsListHtml) return false;
        
        const banner = document.getElementById('progress_banner');
        banner.classList.add('visible');
        banner.classList.add('completed');
        setProgressBarIndeterminate(false);
        document.getElementById('progress_title').textContent = state.title || formatProgressBannerTitle();
        document.getElementById('progress_close').style.display = 'block';
        document.getElementById('progress_bar').style.width = '100%';
        document.getElementById('progress_counter').textContent = state.counter || '';
        document.getElementById('progress_assets_list').innerHTML = state.assetsListHtml;
        document.getElementById('progress_delta').innerHTML = state.deltaHtml || '';
        document.getElementById('progress_delta').className = state.deltaClass || 'progress_delta';
        
        return true;
    } catch (e) {
        return false;
    }
};

/**
 * Render the dashboard page title with the base label and optional ATH mood icon.
 * @param {{ icon?: string } | null} mood - ATH mood payload when available.
 * @returns {void}
 */
const setDashboardTitle = (mood = null) => {
    const titleEl = document.getElementById('dashboard_title');
    if (!titleEl) return;

    titleEl.textContent = mood?.icon ? `${DASHBOARD_TITLE_BASE} ${mood.icon}` : DASHBOARD_TITLE_BASE;
};

/**
 * Render the dashboard ATH overview line with privacy-mode-safe text.
 * @param {{ total?: number, allTimeHighTotal?: number|null, allTimeHighLabel?: string|null }} portfolio - Portfolio payload.
 * @returns {void}
 */
const renderAthDistance = (portfolio) => {
    const el = document.getElementById('ath_distance_value');
    if (!el) return;

    const allTimeHighTotal = portfolio.allTimeHighTotal;
    if (typeof allTimeHighTotal !== 'number' || !Number.isFinite(allTimeHighTotal) || allTimeHighTotal < 0) {
        setDashboardTitle();
        el.textContent = '—';
        el.className = 'overview_value';
        return;
    }

    const total = typeof portfolio.total === 'number' && Number.isFinite(portfolio.total) ? portfolio.total : 0;
    const distanceAmount = total - allTimeHighTotal;
    const isAtAth = Math.abs(distanceAmount) < 0.005;
    const isAboveHistoricalAth = distanceAmount > 0.005;
    const distancePercentage = allTimeHighTotal > 0 ? (distanceAmount / allTimeHighTotal) * 100 : 0;
    const athLabel = escapeHtml(portfolio.allTimeHighLabel || 'saved history');
    const mood = getAthMood(isAtAth ? 0 : distancePercentage);

    setDashboardTitle(mood);

    el.className = `overview_value ${(isAtAth || isAboveHistoricalAth) ? 'positive' : 'negative'}`;

    if (isAtAth) {
        el.innerHTML = `
            <span class="overview_context">At</span>
            <span class="abs_value"> ${formatCompactValue(allTimeHighTotal)}</span>
            <span class="overview_context"> in ${athLabel}</span>
        `;
        return;
    }

    el.innerHTML = `
        <span class="abs_value">${formatCompactValue(distanceAmount)}</span>
        ${renderPercentageValue(`${t(distancePercentage)}%`)}
        <span class="overview_context"> from</span>
        <span class="abs_value"> ${formatCompactValue(allTimeHighTotal)}</span>
        <span class="overview_context"> in ${athLabel}</span>
    `;
};

/**
 * Resolve the view-group rendering order for a portfolio payload.
 * @param {object|null} portfolio - Portfolio data.
 * @returns {string[]}
 */
const getPortfolioViewGroups = (portfolio) => {
    if (!portfolio || typeof portfolio !== 'object') return [];

    if (Array.isArray(portfolio.viewGroups) && portfolio.viewGroups.length) {
        return portfolio.viewGroups;
    }

    return Object.keys(portfolio).filter(key => {
        const group = portfolio[key];
        return group && typeof group === 'object' && typeof group.total === 'number';
    });
};

/**
 * Build a lookup of asset ids to their portfolio view-group metadata.
 * @param {object|null} portfolio - Portfolio data.
 * @returns {Record<string, { groupName: string, total: number|null, displayName: string }>}
 */
const buildPortfolioAssetLookup = (portfolio) => {
    const lookup = {};

    for (const groupName of getPortfolioViewGroups(portfolio)) {
        const details = portfolio?.[groupName]?.details;
        if (!details || typeof details !== 'object') continue;

        for (const [assetId, detail] of Object.entries(details)) {
            lookup[assetId] = {
                groupName,
                total: typeof detail.total === 'number' && Number.isFinite(detail.total) ? detail.total : null,
                displayName: detail.displayName || assetId
            };
        }
    }

    return lookup;
};

/**
 * Resolve which cached asset ids disappeared from a same-schema portfolio payload.
 * @param {object|null} nextPortfolio - Fresh portfolio payload.
 * @param {object|null} cachedPortfolio - Cached portfolio snapshot used for recovery.
 * @returns {Array<{ assetId: string, displayName: string }>}
 */
const getMissingCachedAssets = (nextPortfolio, cachedPortfolio) => {
    if (!nextPortfolio || typeof nextPortfolio !== 'object') return [];
    if (!cachedPortfolio || typeof cachedPortfolio !== 'object') return [];
    if (!nextPortfolio.schemaCacheKey || nextPortfolio.schemaCacheKey !== cachedPortfolio.schemaCacheKey) return [];

    const nextAssetLookup = buildPortfolioAssetLookup(nextPortfolio);
    const cachedAssetLookup = buildPortfolioAssetLookup(cachedPortfolio);

    return Object.entries(cachedAssetLookup)
        .filter(([assetId]) => !Object.prototype.hasOwnProperty.call(nextAssetLookup, assetId))
        .map(([assetId, detail]) => ({
            assetId,
            displayName: detail.displayName || assetId,
        }));
};

/**
 * Clone and sort one dashboard detail map by descending asset total.
 * @param {Record<string, { total?: number, displayName?: string }>|null|undefined} details - Asset detail map.
 * @returns {Record<string, { total?: number, displayName?: string }>}
 */
const clonePortfolioDetails = (details) => Object.entries(details || {})
    .map(([assetId, detail]) => [assetId, { ...detail }])
    .sort(([, left], [, right]) => {
        const leftTotal = Number(left?.total);
        const rightTotal = Number(right?.total);
        const safeLeft = Number.isFinite(leftTotal) ? leftTotal : 0;
        const safeRight = Number.isFinite(rightTotal) ? rightTotal : 0;
        return safeRight - safeLeft;
    })
    .reduce((acc, [assetId, detail]) => {
        acc[assetId] = detail;
        return acc;
    }, {});

/**
 * Preserve cached dashboard asset rows when a refreshed payload omits failed same-schema assets.
 * @param {object|null} nextPortfolio - Fresh portfolio payload from the backend.
 * @param {object|null} cachedPortfolio - Previously persisted browser-local portfolio.
 * @returns {object|null}
 */
const preserveCachedPortfolioOnFailure = (nextPortfolio, cachedPortfolio) => {
    if (!nextPortfolio || typeof nextPortfolio !== 'object') return nextPortfolio;
    if (!cachedPortfolio || typeof cachedPortfolio !== 'object') return nextPortfolio;
    if (!nextPortfolio.schemaCacheKey || nextPortfolio.schemaCacheKey !== cachedPortfolio.schemaCacheKey) return nextPortfolio;

    const missingCachedAssets = getMissingCachedAssets(nextPortfolio, cachedPortfolio);
    if (!hasPortfolioFailures(nextPortfolio) && !missingCachedAssets.length) return nextPortfolio;

    const groupNames = [...new Set([
        ...getPortfolioViewGroups(nextPortfolio),
        ...getPortfolioViewGroups(cachedPortfolio)
    ])];
    let didRestoreCachedAssets = false;
    let total = 0;
    const mergedPortfolio = { ...nextPortfolio };

    for (const groupName of groupNames) {
        const nextGroup = nextPortfolio[groupName];
        const cachedGroup = cachedPortfolio[groupName];
        const nextDetails = nextGroup?.details && typeof nextGroup.details === 'object'
            ? clonePortfolioDetails(nextGroup.details)
            : {};
        const cachedDetails = cachedGroup?.details && typeof cachedGroup.details === 'object'
            ? cachedGroup.details
            : null;

        if (cachedDetails) {
            for (const [assetId, detail] of Object.entries(cachedDetails)) {
                if (Object.prototype.hasOwnProperty.call(nextDetails, assetId)) continue;
                nextDetails[assetId] = { ...detail };
                didRestoreCachedAssets = true;
            }
        }

        const mergedDetails = clonePortfolioDetails(nextDetails);
        const groupTotal = Object.values(mergedDetails).reduce((sum, detail) => {
            const numericTotal = Number(detail?.total);
            return sum + (Number.isFinite(numericTotal) ? numericTotal : 0);
        }, 0);

        if (nextGroup || cachedGroup || Object.keys(mergedDetails).length) {
            mergedPortfolio[groupName] = {
                ...(nextGroup && typeof nextGroup === 'object' ? nextGroup : {}),
                total: groupTotal,
                details: mergedDetails,
            };
            total += groupTotal;
        }
    }

    if (!didRestoreCachedAssets) {
        return nextPortfolio;
    }

    for (const key of Object.keys(mergedPortfolio)) {
        if (PORTFOLIO_META_KEYS.has(key) || groupNames.includes(key)) continue;
        delete mergedPortfolio[key];
    }

    mergedPortfolio.total = total;
    if (!Array.isArray(mergedPortfolio.viewGroups) || !mergedPortfolio.viewGroups.length) {
        mergedPortfolio.viewGroups = groupNames;
    }

    const mergedFailureNames = new Set(
        Array.isArray(nextPortfolio.failures)
            ? nextPortfolio.failures.filter(value => typeof value === 'string' && value.trim())
            : []
    );
    missingCachedAssets.forEach(({ displayName }) => mergedFailureNames.add(displayName));
    mergedPortfolio.failures = [...mergedFailureNames];

    return mergedPortfolio;
};

/**
 * Persist the latest dashboard portfolio after restoring cached same-schema assets for failed refreshes.
 * @param {object|null} nextPortfolio - Fresh portfolio payload from the backend.
 * @param {object|null} [cachedPortfolio=null] - Previously persisted browser-local portfolio.
 * @returns {object|null}
 */
const persistPortfolioSnapshot = (nextPortfolio, cachedPortfolio = null) => {
    const fallbackPortfolio = cachedPortfolio ?? readPortfolioSnapshot(PORTFOLIO_CACHE_KEY);
    const resolvedPortfolio = preserveCachedPortfolioOnFailure(nextPortfolio, fallbackPortfolio);
    writePortfolioSnapshot(PORTFOLIO_CACHE_KEY, resolvedPortfolio);
    return resolvedPortfolio;
};

/**
 * Convert an arbitrary label into a stable data-testid suffix.
 * @param {string} value - Raw identifier.
 * @returns {string}
 */
const toProgressBannerSlug = (value) => String(value).replaceAll(/[^a-zA-Z0-9_-]+/g, '-');

/**
 * Build the progress-banner asset row test id from an asset id.
 * @param {string} assetId - Asset identifier.
 * @returns {string}
 */
const getProgressAssetTestId = (assetId) => `progress-asset-${toProgressBannerSlug(assetId)}`;

/**
 * Build the progress-banner group row test id from a view-group name.
 * @param {string} groupName - View-group label.
 * @returns {string}
 */
const getProgressGroupTestId = (groupName) => `progress-group-${toProgressBannerSlug(groupName)}`;

/**
 * Build the dashboard risk badge test id from an asset id.
 * @param {string} assetId - Asset identifier.
 * @returns {string}
 */
const getDashboardAssetRiskTestId = (assetId) => `dashboard-asset-risk-${toProgressBannerSlug(assetId)}`;

/**
 * Build the dashboard risk badge test id from a view-group name.
 * @param {string} groupName - View-group label.
 * @returns {string}
 */
const getDashboardGroupRiskTestId = (groupName) => `dashboard-group-risk-${toProgressBannerSlug(groupName)}`;

/**
 * Normalize a numeric risk score for UI output.
 * @param {number} value - Raw risk score.
 * @returns {string}
 */
const formatRiskScore = (value) => {
    const rounded = Number(value.toFixed(1));
    return String(rounded);
};

/**
 * Render a risk summary badge for group and portfolio-level indicators.
 * @param {number|null} riskValue - Weighted risk value.
 * @param {{ className?: string, testId?: string }} [options={}] - Rendering overrides.
 * @returns {string}
 */
const renderRiskSummaryBadge = (riskValue, options = {}) => {
    const {
        className = 'risk_badge',
        testId = ''
    } = options;

    if (typeof riskValue !== 'number' || !Number.isFinite(riskValue)) return '';

    const testIdAttr = testId ? ` data-testid="${escapeHtml(testId)}"` : '';
    return `<span class="${className}"${testIdAttr}>Risk ${escapeHtml(formatRiskScore(riskValue))}/7</span>`;
};

/**
 * Compute a weighted average risk score for one details object.
 * @param {Record<string, { total?: number }>|null|undefined} details - Category details map.
 * @returns {number|null}
 */
const getWeightedRiskFromDetails = (details) => {
    if (!details || typeof details !== 'object') return null;

    let weightedSum = 0;
    let totalWeight = 0;

    for (const [assetId, detail] of Object.entries(details)) {
        const assetSize = Number(detail?.total);
        if (!Number.isFinite(assetSize) || assetSize <= 0) continue;

        const indicator = currentAssetRiskState.values?.[assetId];
        const riskValue = Number(indicator?.value);
        if (!Number.isFinite(riskValue)) continue;

        weightedSum += riskValue * assetSize;
        totalWeight += assetSize;
    }

    if (totalWeight <= 0) return null;
    return weightedSum / totalWeight;
};

/**
 * Compute a weighted average risk score across all dashboard assets with risk values.
 * @param {object|null} portfolio - Portfolio payload.
 * @returns {number|null}
 */
const getWeightedPortfolioRisk = (portfolio) => {
    if (!portfolio || typeof portfolio !== 'object') return null;

    let weightedSum = 0;
    let totalWeight = 0;

    for (const groupName of getPortfolioViewGroups(portfolio)) {
        const details = portfolio?.[groupName]?.details;
        if (!details || typeof details !== 'object') continue;

        for (const [assetId, detail] of Object.entries(details)) {
            const assetSize = Number(detail?.total);
            if (!Number.isFinite(assetSize) || assetSize <= 0) continue;

            const indicator = currentAssetRiskState.values?.[assetId];
            const riskValue = Number(indicator?.value);
            if (!Number.isFinite(riskValue)) continue;

            weightedSum += riskValue * assetSize;
            totalWeight += assetSize;
        }
    }

    if (totalWeight <= 0) return null;
    return weightedSum / totalWeight;
};

/**
 * Normalize the asset risk payload returned by the backend service.
 * @param {{ values?: Record<string, { value?: number, label?: string }|number>, failures?: string[] }|null|undefined} payload - Raw backend response.
 * @returns {{ values: Record<string, { value: number, label: string }>, failures: string[], errorMessage: string }}
 */
const normalizeAssetRiskState = (payload) => {
    const nextValues = {};
    const rawValues = payload?.values;
    if (rawValues && typeof rawValues === 'object') {
        for (const [assetId, indicator] of Object.entries(rawValues)) {
            const numericValue = Number(typeof indicator === 'object' ? indicator?.value : indicator);
            if (Number.isFinite(numericValue)) {
                nextValues[assetId] = {
                    value: numericValue,
                    label: typeof indicator === 'object' && typeof indicator?.label === 'string' && indicator.label.trim()
                        ? indicator.label.trim()
                        : 'Risk'
                };
            }
        }
    }

    return {
        values: nextValues,
        failures: Array.isArray(payload?.failures)
            ? payload.failures.filter(value => typeof value === 'string' && value.trim())
            : [],
        errorMessage: ''
    };
};

/**
 * Resolve all dashboard error messages, including asset risk fetch failures.
 * @param {{ failures?: string[] }|null} portfolio - Current portfolio payload.
 * @returns {string[]}
 */
const getDashboardErrorMessages = (portfolio) => {
    const portfolioFailures = Array.isArray(portfolio?.failures) ? portfolio.failures : [];
    const riskFailures = currentAssetRiskState.failures.map(assetId => `Risk indicator unavailable for ${assetId}`);
    const backgroundFailures = currentAssetRiskState.errorMessage ? [currentAssetRiskState.errorMessage] : [];
    return [...portfolioFailures, ...riskFailures, ...backgroundFailures];
};

/**
 * Render the shared dashboard error banner from portfolio and asset risk error state.
 * @param {{ failures?: string[] }|null} portfolio - Current portfolio payload.
 * @returns {void}
 */
const renderDashboardErrors = (portfolio) => {
    const errorBanner = document.getElementById('error_banner');
    const errorList = document.getElementById('error_list');
    const errorMessages = getDashboardErrorMessages(portfolio);

    if (errorMessages.length > 0) {
        errorList.textContent = `${errorMessages.join(', ')} (using cached values if available)`;
        errorBanner.classList.add('visible');
        return;
    }

    errorList.textContent = '';
    errorBanner.classList.remove('visible');
};

/**
 * Render the risk badge for one dashboard asset row when a value is available.
 * @param {string} assetId - Portfolio asset identifier.
 * @returns {string}
 */
const renderAssetRiskBadge = (assetId) => {
    const indicator = currentAssetRiskState.values?.[assetId];
    const numericValue = Number(indicator?.value);
    if (!Number.isFinite(numericValue)) return '';

    const label = typeof indicator?.label === 'string' && indicator.label.trim()
        ? indicator.label.trim()
        : 'Risk';

    return `<span class="subrow_sri" data-testid="${getDashboardAssetRiskTestId(assetId)}">${escapeHtml(label)} ${escapeHtml(String(numericValue))}/7</span>`;
};

/**
 * Render the overview portfolio weighted-risk indicator.
 * @param {object|null} portfolio - Current portfolio payload.
 * @returns {void}
 */
const renderPortfolioRiskIndicator = (portfolio) => {
    const el = document.getElementById('portfolio_risk_value');
    if (!el) return;

    const weightedRisk = getWeightedPortfolioRisk(portfolio);
    if (typeof weightedRisk !== 'number' || !Number.isFinite(weightedRisk)) {
        el.textContent = '—';
        return;
    }

    el.innerHTML = renderRiskSummaryBadge(weightedRisk, {
        className: 'risk_badge overview_risk_badge',
        testId: 'overview-portfolio-risk'
    });
};

/**
 * Calculate absolute and percentage delta metadata for progress rows.
 * @param {number|null} currentValue - Current value.
 * @param {number|null|undefined} previousValue - Previous cached value.
 * @returns {{ diff: number, diffPct: number|null, sign: string, diffClass: string, diffPctLabel: string }|null}
 */
const getProgressDiffMeta = (currentValue, previousValue) => {
    if (typeof currentValue !== 'number' || !Number.isFinite(currentValue)) return null;
    if (typeof previousValue !== 'number' || !Number.isFinite(previousValue)) return null;

    const diff = currentValue - previousValue;
    const diffPct = previousValue !== 0 ? (diff / previousValue) * 100 : null;
    const sign = diff >= 0 ? '+' : '';
    const diffClass = diff >= 0 ? 'positive' : 'negative';
    const diffPctLabel = diffPct === null ? '—' : `${sign}${t(diffPct)}%`;

    return {
        diff,
        diffPct,
        sign,
        diffClass,
        diffPctLabel
    };
};

/**
 * Render a progress-banner diff badge.
 * @param {{ diff: number, sign: string, diffClass: string, diffPctLabel: string }|null} diffMeta - Precomputed diff metadata.
 * @param {string} [className='asset_diff'] - CSS class applied to the diff badge.
 * @param {string} [emptyLabel=''] - Placeholder shown when no baseline exists.
 * @returns {string}
 */
const renderProgressDiffHtml = (diffMeta, className = 'asset_diff', emptyLabel = '') => {
    if (!diffMeta) {
        return emptyLabel ? `<span class="${className} empty">${emptyLabel}</span>` : '';
    }

    return `<span class="${className} ${diffMeta.diffClass}"><span class="abs_value">${diffMeta.sign}${formatCompactValue(diffMeta.diff)}</span>${renderPercentageValue(diffMeta.diffPctLabel)}</span>`;
};

/**
 * Render one progress-banner asset row.
 * @param {{ assetName: string, assetId: string, assetTotal: number|null, failed: boolean }} asset - Streamed asset metadata.
 * @param {{ grouped?: boolean, displayName?: string, assetTotal?: number|null }} [options={}] - Row rendering overrides.
 * @returns {string}
 */
const renderProgressAssetRow = (asset, options = {}) => {
    const {
        grouped = false,
        displayName = asset.assetName,
        assetTotal = asset.assetTotal
    } = options;

    const rowClasses = ['progress_asset_row'];
    if (grouped) {
        rowClasses.push('progress_asset_subrow');
    }

    const diffMeta = asset.failed ? null : getProgressDiffMeta(assetTotal, previousAssetValues[asset.assetId]);
    const resolvedAssetTotal = typeof assetTotal === 'number' && Number.isFinite(assetTotal) ? assetTotal : 0;
    const valueDisplay = asset.failed
        ? '<span class="asset_value failed">❌ Failed</span>'
        : `<span class="asset_value"><span class="abs_value">${formatCompactValue(resolvedAssetTotal)} ✓</span><span class="pct_value pct_placeholder">—</span></span>${renderProgressDiffHtml(diffMeta)}`;

    return `<div class="${rowClasses.join(' ')}" data-testid="${getProgressAssetTestId(asset.assetId)}"><span class="asset_name">${escapeHtml(displayName)}</span><span>${valueDisplay}</span></div>`;
};

/**
 * Re-render completed streamed assets grouped by dashboard view group.
 * @param {object} portfolio - Final portfolio payload from the stream.
 * @param {object|null} cachedPortfolio - Previous cached portfolio used as the diff baseline.
 * @returns {void}
 */
const renderCompletedProgressAssets = (portfolio, cachedPortfolio = null) => {
    const listEl = document.getElementById('progress_assets_list');
    const currentAssetLookup = buildPortfolioAssetLookup(portfolio);
    const previousAssetLookup = buildPortfolioAssetLookup(cachedPortfolio);
    const groupedAssets = new Map();

    for (const asset of progressAssetItems) {
        const currentAsset = currentAssetLookup[asset.assetId];
        const previousAsset = previousAssetLookup[asset.assetId];
        const groupName = currentAsset?.groupName || previousAsset?.groupName || 'Ungrouped';
        const resolvedCurrentTotal = typeof currentAsset?.total === 'number'
            ? currentAsset.total
            : (typeof asset.assetTotal === 'number' && Number.isFinite(asset.assetTotal) ? asset.assetTotal : null);
        const resolvedPreviousTotal = typeof previousAsset?.total === 'number'
            ? previousAsset.total
            : (typeof previousAssetValues[asset.assetId] === 'number' && Number.isFinite(previousAssetValues[asset.assetId])
                ? previousAssetValues[asset.assetId]
                : null);

        if (!groupedAssets.has(groupName)) {
            groupedAssets.set(groupName, {
                currentTotal: 0,
                previousTotal: 0,
                hasPrevious: false,
                items: []
            });
        }

        const group = groupedAssets.get(groupName);
        if (resolvedCurrentTotal !== null) {
            group.currentTotal += resolvedCurrentTotal;
        }
        if (resolvedPreviousTotal !== null) {
            group.previousTotal += resolvedPreviousTotal;
            group.hasPrevious = true;
        }

        group.items.push({
            ...asset,
            assetName: currentAsset?.displayName || previousAsset?.displayName || asset.assetName,
            assetTotal: resolvedCurrentTotal
        });
    }

    const orderedGroupNames = getPortfolioViewGroups(portfolio).filter(groupName => groupedAssets.has(groupName));
    for (const groupName of groupedAssets.keys()) {
        if (!orderedGroupNames.includes(groupName)) {
            orderedGroupNames.push(groupName);
        }
    }

    listEl.innerHTML = orderedGroupNames.map(groupName => {
        const group = groupedAssets.get(groupName);
        const groupDiffMeta = group.hasPrevious ? getProgressDiffMeta(group.currentTotal, group.previousTotal) : null;

        return `
            <div class="progress_group_section" data-testid="${getProgressGroupTestId(groupName)}">
                <div class="progress_group_row">
                    <span class="progress_group_name">${escapeHtml(groupName)}:</span>
                    <span class="progress_group_summary">${renderProgressDiffHtml(groupDiffMeta, 'progress_group_diff', '—')}</span>
                </div>
                ${group.items.map(asset => renderProgressAssetRow(asset, { grouped: true, displayName: asset.assetName, assetTotal: asset.assetTotal })).join('')}
            </div>
        `;
    }).join('');
};

/**
 * Append a streamed refresh update to the progress banner.
 * @param {{ assetName: string, assetId: string, value: number|null, assetTotal: number|null, failed: boolean, index: number, total: number, currentPortfolioTotal: number, prevMonthTotal: number|null }} data - Progress payload from SSE.
 * @returns {void}
 */
const updateProgress = (data) => {
    const { assetName, assetId, value, assetTotal, failed, index, total, currentPortfolioTotal, prevMonthTotal } = data;
    let latestAssetDiff = null;
    
    // Update progress bar
    const percentage = (index / total) * 100;
    document.getElementById('progress_bar').style.width = percentage + '%';
    document.getElementById('progress_counter').textContent = `${index}/${total}`;

    // Calculate diff from previous value
    if (!failed && assetTotal !== null && previousAssetValues[assetId] !== undefined) {
        latestAssetDiff = getProgressDiffMeta(assetTotal, previousAssetValues[assetId]);
        runningDelta += latestAssetDiff.diff; // Accumulate delta
    }

    const nextAssetState = { assetName, assetId, assetTotal, failed };
    const existingIndex = progressAssetItems.findIndex(asset => asset.assetId === assetId);
    if (existingIndex === -1) {
        progressAssetItems.push(nextAssetState);
    } else {
        progressAssetItems[existingIndex] = nextAssetState;
    }

    // Append asset to list
    const listEl = document.getElementById('progress_assets_list');
    listEl.insertAdjacentHTML('beforeend', renderProgressAssetRow(nextAssetState));
    // Auto-scroll to bottom
    listEl.scrollTop = listEl.scrollHeight;

    // Update portfolio delta using the current asset's previous value as the percentage baseline.
    if (latestAssetDiff) {
        const { diffPct, sign: assetSign } = latestAssetDiff;
        const runningSign = runningDelta >= 0 ? '+' : '';
        const emoji = runningDelta >= 0 ? '🚀' : '🔥';
        const deltaPctLabel = diffPct === null ? '—' : `${assetSign}${t(diffPct)}%`;
        
        const deltaEl = document.getElementById('progress_delta');
        deltaEl.innerHTML = `<span class="abs_value">${runningSign}${formatCompactValue(runningDelta)}</span>${renderPercentageValue(deltaPctLabel)} ${emoji}`;
        deltaEl.className = 'progress_delta ' + (runningDelta >= 0 ? 'positive' : 'negative');
    }
};

/**
 * Stream portfolio data through the SSE endpoint while showing per-asset progress updates.
 * @param {{ refresh?: boolean, title?: string, buttonLabel?: string, persistCompletedBanner?: boolean, fallbackLoadingMessage?: string|null }} [options] - Streaming behavior overrides.
 * @returns {Promise<object>}
 */
const streamPortfolioRefresh = (options = {}) => {
    return new Promise((resolve, reject) => {
        const {
            refresh = true,
            title = refresh ? '🔄 Refreshing Portfolio...' : '🔄 Loading Portfolio...',
            buttonLabel = refresh ? 'Refreshing...' : 'Loading...',
            persistCompletedBanner = refresh,
            fallbackLoadingMessage = refresh ? null : 'Fetching the latest portfolio data...'
        } = options;
        const refreshButton = document.getElementById('refresh_button');
        const originalLabel = refreshButton.innerHTML;
        refreshButton.disabled = true;
        refreshButton.innerHTML = buttonLabel;

        // Store initial total and build previous asset values map
        const cachedPortfolio = readPortfolioSnapshot(PORTFOLIO_CACHE_KEY);
        const baselinePortfolio = getRefreshBaselinePortfolio(cachedPortfolio);
        
        // Build map of assetId -> previous total value from the last fully successful refresh.
        previousAssetValues = {};
        if (baselinePortfolio) {
            const viewGroups = Object.keys(baselinePortfolio).filter(k => 
                baselinePortfolio[k] && typeof baselinePortfolio[k] === 'object' && baselinePortfolio[k].details
            );
            for (const group of viewGroups) {
                const details = baselinePortfolio[group].details || {};
                for (const [assetId, assetData] of Object.entries(details)) {
                    previousAssetValues[assetId] = assetData.total;
                }
            }
        }

        showProgressBanner(title);

        const password = getPassword();
        const eventSource = new EventSource(`${API_BASE}/portfolio/stream?password=${encodeURIComponent(password)}&refresh=${refresh ? 'true' : 'false'}`);

        const fallbackToStandardFetch = () => {
            if (fallbackLoadingMessage) {
                showLoadingProgressBanner({
                    title,
                    message: fallbackLoadingMessage
                });
            } else {
                hideProgressBanner();
            }

            refreshButton.disabled = false;
            refreshButton.innerHTML = originalLabel;

            fetchData(refresh).then(portfolio => {
                const resolvedPortfolio = persistPortfolioSnapshot(portfolio, cachedPortfolio);
                markSuccessfulPortfolioSnapshot(resolvedPortfolio);
                if (fallbackLoadingMessage) {
                    hideProgressBanner();
                }
                resolve(resolvedPortfolio);
            }).catch((error) => {
                if (fallbackLoadingMessage) {
                    hideProgressBanner();
                }
                reject(error);
            });
        };

        eventSource.addEventListener('progress', (event) => {
            const data = JSON.parse(event.data);
            updateProgress(data);
        });

        eventSource.addEventListener('complete', (event) => {
            const portfolio = JSON.parse(event.data);
            eventSource.close();

            const resolvedPortfolio = persistPortfolioSnapshot(portfolio, cachedPortfolio);
            if (hasPortfolioFailures(resolvedPortfolio)) {
                completeProgressBanner(persistCompletedBanner, PARTIAL_REFRESH_BANNER_TITLE);
            } else {
                markSuccessfulPortfolioSnapshot(resolvedPortfolio);
                completeProgressBanner(persistCompletedBanner);
            }
            renderCompletedProgressAssets(resolvedPortfolio, baselinePortfolio);
            refreshButton.disabled = false;
            refreshButton.innerHTML = originalLabel;
            resolve(resolvedPortfolio);
        });

        eventSource.addEventListener('error', (event) => {
            // Check if it's a custom error event with data
            if (event.data) {
                console.error('Stream error:', JSON.parse(event.data));
            }
            eventSource.close();
            fallbackToStandardFetch();
        });

        eventSource.onerror = () => {
            // Connection error - close and fallback
            eventSource.close();

            fallbackToStandardFetch();
        };
    });
};

/**
 * Build the inline accent style for one dashboard category card.
 * @param {string} categoryKey - View-group name.
 * @returns {string}
 */
const getCategoryCardStyle = (categoryKey) => {
    const accentColor = typeof ChartModule === 'object' && typeof ChartModule.getViewGroupColor === 'function'
        ? ChartModule.getViewGroupColor(categoryKey)
        : '#9E9E9E';

    return `--group-accent: ${accentColor};`;
};

/**
 * Fetch asset risk values in the background and re-render the dashboard rows when they arrive.
 * @param {object} portfolio - Portfolio currently shown in the dashboard.
 * @param {boolean} refresh - Whether this request is part of a manual refresh.
 * @returns {Promise<void>}
 */
const refreshDashboardAssetRisk = async (portfolio, refresh) => {
    const requestId = ++currentAssetRiskRequest;

    try {
        const nextState = normalizeAssetRiskState(await fetchAssetRiskIndicators(refresh));
        if (requestId !== currentAssetRiskRequest) return;

        currentAssetRiskState = nextState;
    } catch (error) {
        console.error('Failed to load dashboard risk values:', error);
        if (requestId !== currentAssetRiskRequest) return;

        currentAssetRiskState = {
            ...currentAssetRiskState,
            errorMessage: 'Failed to load risk indicators'
        };
    }

    renderDashboardErrors(portfolio);
    renderPortfolioRiskIndicator(portfolio);
    renderTableView(portfolio);
};

/**
 * Render one dashboard category card with its nested asset rows.
 * @param {string} categoryKey - View-group name.
 * @param {{ total: number, details?: Record<string, { total: number, displayName?: string }> }} categoryData - Category totals.
 * @param {number} portfolioTotal - Whole-portfolio total.
 * @returns {string}
 */
const renderCategoryRow = (categoryKey, categoryData, portfolioTotal) => {
    if (!categoryData) return '';

    const categoryPct = pct(categoryData.total, portfolioTotal);
    const weightedRisk = getWeightedRiskFromDetails(categoryData.details);
    const groupRiskBadge = renderRiskSummaryBadge(weightedRisk, {
        className: 'risk_badge group_risk_badge',
        testId: getDashboardGroupRiskTestId(categoryKey)
    });
    let mainRowValueHtml = `<span class="abs_value">${formatCompactValue(categoryData.total)}</span>${renderPercentageValue(`${categoryPct}%`)}`;
    const formatDetailValue = (value) => formatCompactValue(value, 1, { includeCurrency: false });

    // Render subrows for details using displayName from API
    let subrowsHtml = '';
    if (categoryData.details) {
        for (const [key, detail] of Object.entries(categoryData.details)) {
            const label = escapeHtml(detail.displayName || key);
            const assetPct = pct(detail.total, portfolioTotal);
            const sriBadge = renderAssetRiskBadge(key);
            subrowsHtml += `
                <div class="subrow">
                    <div class="subrow_meta">
                        <div class="subrow_title">${label}:</div>
                        ${sriBadge}
                    </div>
                    <div class="subrow_value"><span class="abs_value">${formatDetailValue(detail.total)}</span>${renderPercentageValue(`${assetPct}%`)}</div>
                </div>
            `;
        }
    }

    return `
        <div class="row group_row" style="${getCategoryCardStyle(categoryKey)}">
            <div class="mainrow">
                <div class="row_meta">
                    <div class="row_title">${escapeHtml(categoryKey)}:</div>
                    ${groupRiskBadge}
                </div>
                <div class="row_value">${mainRowValueHtml}</div>
            </div>
            ${subrowsHtml}
        </div>
    `;
};

/**
 * Render the grouped dashboard table view.
 * @param {object} portfolio - Portfolio data.
 * @returns {void}
 */
const renderTableView = (portfolio) => {
    const tableView = document.getElementById('table_view');
    let html = '';

    const viewGroupsOrder = getPortfolioViewGroups(portfolio);

    for (const viewGroup of viewGroupsOrder) {
        if (portfolio[viewGroup]) {
            html += renderCategoryRow(viewGroup, portfolio[viewGroup], portfolio.total);
        }
    }

    tableView.innerHTML = html;
};

/**
 * Fetch portfolio data from the standard HTTP endpoint.
 * @param {boolean} refresh - Whether the backend should refresh live values.
 * @returns {Promise<object>}
 */
const fetchData = async (refresh) => {
    const response = await authFetch(`${API_BASE}/portfolio?refresh=` + refresh);
    const data = await response.json();
    return data;
}

/**
 * Resolve the portfolio from cache or backend refresh flows.
 * @param {boolean} refresh - Whether to force a refresh.
 * @returns {Promise<object>}
 */
const getPortfolio = async (refresh) => {
    let portfolio = readPortfolioSnapshot(PORTFOLIO_CACHE_KEY);
    // Force refresh if displayName is missing or viewGroups are missing (cache from old version)
    const needsRefresh = portfolio && (
        (portfolio.Equity?.details && Object.values(portfolio.Equity.details).some(d => !d.displayName)) ||
        !portfolio.Gold ||
        !portfolio.Equity ||
        !Object.prototype.hasOwnProperty.call(portfolio, 'allTimeHighTotal') ||
        !Object.prototype.hasOwnProperty.call(portfolio, 'allTimeHighLabel')
    );
    if (portfolio === null || refresh || needsRefresh) {
        if (refresh) {
            // Use SSE streaming for manual refresh
            return await streamPortfolioRefresh();
        } else if (portfolio === null) {
            // Stream first-load progress so uncached visits show per-asset updates.
            return await streamPortfolioRefresh({
                refresh: false,
                persistCompletedBanner: false
            });
        } else {
            // Use regular fetch for automatic cache migrations.
            const refreshButton = document.getElementById('refresh_button');
            const originalLabel = refreshButton.innerHTML;
            refreshButton.disabled = true;
            refreshButton.innerHTML = 'Refreshing...';
            try {
                const newPortfolio = await fetchData(false);
                const resolvedPortfolio = persistPortfolioSnapshot(newPortfolio, portfolio);
                markSuccessfulPortfolioSnapshot(resolvedPortfolio);
                return resolvedPortfolio;
            } finally {
                refreshButton.disabled = false;
                refreshButton.innerHTML = originalLabel;
            }
        }
    }
    return portfolio;
}

/**
 * Merge the latest schema view-group order into cached portfolio data when possible.
 * @param {object} portfolio - Portfolio data from cache or backend.
 * @returns {Promise<object>}
 */
const mergeViewGroupsIntoPortfolio = async (portfolio) => {
    // Keep older cached portfolio working, but ensure we always render with the latest group labels/order.
    try {
        const schema = await fetchAssetsSchema();
        if (schema && Array.isArray(schema.viewGroups)) {
            let resolvedPortfolio = portfolio;
            if (resolvedPortfolio && resolvedPortfolio.schemaCacheKey !== schema.schemaCacheKey) {
                resolvedPortfolio = await fetchData(false);
                resolvedPortfolio = persistPortfolioSnapshot(resolvedPortfolio, portfolio);
                markSuccessfulPortfolioSnapshot(resolvedPortfolio);
            }

            /**
             * Reconcile cached portfolio group keys with the latest schema ordering.
             * @param {object} p - Cached portfolio object.
             * @param {string[]} nextGroups - Latest view-group list.
             * @returns {object}
             */
            const migratePortfolioViewGroups = (p, nextGroups) => {
                if (!p || typeof p !== 'object') return p;

                const reserved = new Set(['total', 'prevMonthTotal', 'initYearNetworth', 'failures', 'viewGroups']);
                const groupKeys = Object.keys(p).filter(k => {
                    if (reserved.has(k)) return false;
                    const v = p[k];
                    return v && typeof v === 'object' && typeof v.total === 'number';
                });

                // No groups in cache => nothing to migrate.
                if (!groupKeys.length) return { ...p, viewGroups: nextGroups };

                // If the cached group keys already match the schema groups (set-wise), we're done.
                const cachedSet = new Set(groupKeys);
                const nextSet = new Set(nextGroups);
                const sameSet = groupKeys.length === nextGroups.length && groupKeys.every(k => nextSet.has(k));
                if (sameSet) return { ...p, viewGroups: nextGroups };

                // Heuristic rename detection: if schema has exactly one added and one removed group,
                // treat it as rename and remap the cached portfolio key.
                const removed = groupKeys.filter(g => !nextSet.has(g));
                const added = nextGroups.filter(g => !cachedSet.has(g));

                if (removed.length === 1 && added.length === 1) {
                    const from = removed[0];
                    const to = added[0];

                    const migrated = { ...p };
                    if (migrated[from] && !migrated[to]) {
                        migrated[to] = migrated[from];
                        delete migrated[from];
                    }
                    migrated.viewGroups = nextGroups;
                    return migrated;
                }

                // Fallback: just update ordering/labels. Data will refresh on next fetch.
                return { ...p, viewGroups: nextGroups };
            };

            const migrated = migratePortfolioViewGroups(resolvedPortfolio, schema.viewGroups);

            // Persist migration so the first render (cached) doesn't show stale keys next time.
            try {
                writePortfolioSnapshot(PORTFOLIO_CACHE_KEY, migrated);
            } catch (e) {
                // ignore
            }

            return migrated;
        }
    } catch (e) {
        // ignore schema fetch errors; portfolio can still render
    }
    return portfolio;
};

/**
 * Render cached data immediately, then refresh and render the latest portfolio data.
 * @param {boolean} refresh - Whether to force a live refresh.
 * @returns {Promise<void>}
 */
const renderPortfolio = async (refresh) => {
    // Show cached data first (if available) so old values remain visible during refresh
    let portfolio = readPortfolioSnapshot(PORTFOLIO_CACHE_KEY);
    if (portfolio) {
        renderPortfolioData(portfolio);
        hidePageLoading();
    }

    try {
        // Fetch new data if needed
        portfolio = await getPortfolio(refresh);
        portfolio = await mergeViewGroupsIntoPortfolio(portfolio);
        renderPortfolioData(portfolio);
        void refreshDashboardAssetRisk(portfolio, Boolean(refresh));
    } finally {
        hidePageLoading();
    }
}

/**
 * Render the full dashboard UI from portfolio data.
 * @param {{ total: number, prevMonthTotal: number|null, initYearNetworth: number|null, failures?: string[] }} portfolio - Portfolio data to render.
 * @returns {void}
 */
const renderPortfolioData = (portfolio) => {
    const total = portfolio.total;
    const prevMonthTotal = portfolio.prevMonthTotal;
    const initYearNetworth = portfolio.initYearNetworth;

    const delta = total - initYearNetworth;
    const hasInitYear = typeof initYearNetworth === 'number' && initYearNetworth > 0;
    const deltaPercentage = hasInitYear ? (delta / initYearNetworth) * 100 : null;
    const deltaPercentageLabel = delta >= 0 ? '🚀' : '🔥';
    const prevMonthdelta = total - prevMonthTotal;
    const hasPrevMonth = typeof prevMonthTotal === 'number' && prevMonthTotal > 0;
    const prevMonthdeltaPercentage = hasPrevMonth ? (prevMonthdelta / prevMonthTotal) * 100 : null;
    const prevMonthdeltaPercentageLabel = prevMonthdelta >= 0 ? '🚀' : '🔥';

    // Update overview values
    document.getElementById('total_value').innerHTML = `<span class="abs_value">${formatCompactValue(total)}</span><span class="pct_value pct_placeholder">—</span>`;
    document.getElementById('delta_value').innerHTML = `
        <span class="abs_value">${formatCompactValue(delta)}</span>
        ${renderPercentageValue(deltaPercentage === null ? '—' : `${t(deltaPercentage)}%`)}
        ${deltaPercentageLabel}
    `;
    document.getElementById('prevMonth_delta_value').innerHTML = `
        <span class="abs_value">${formatCompactValue(prevMonthdelta)}</span>
        ${renderPercentageValue(prevMonthdeltaPercentage === null ? '—' : `${t(prevMonthdeltaPercentage)}%`)}
        ${prevMonthdeltaPercentageLabel}
    `;
    renderPortfolioRiskIndicator(portfolio);
    renderAthDistance(portfolio);
    renderLastUpdate();

    // Show/hide error banner based on failures
    renderDashboardErrors(portfolio);

    // Render the table view dynamically
    renderTableView(portfolio);

    // Render the pie chart
    ChartModule.renderPieChart('portfolio_chart', portfolio);
}

/**
 * Render the dashboard last-update timestamp from localStorage.
 * @returns {void}
 */
const renderLastUpdate = () => {
    const el = document.getElementById('last_update_value');
    if (!el) return;

    const raw = localStorage.getItem(LAST_UPDATE_KEY);
    if (!raw) {
        el.textContent = '—';
        return;
    }

    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) {
        el.textContent = '—';
        return;
    }

    el.textContent = date.toLocaleString();
};

/**
 * Persist the current time as the last successful dashboard refresh timestamp.
 * @returns {void}
 */
const setLastUpdateNow = () => {
    try {
        localStorage.setItem(LAST_UPDATE_KEY, new Date().toISOString());
    } catch (e) {
        // ignore
    }
    renderLastUpdate();
};

window.addEventListener('absolute-visibility-change', () => {
    const cached = readPortfolioSnapshot(PORTFOLIO_CACHE_KEY);
    if (cached) {
        renderPortfolioData(cached);
    }
});

// Initialize on page load
setDashboardTitle();
renderLastUpdate();
restoreProgressBanner();
renderPortfolio();
