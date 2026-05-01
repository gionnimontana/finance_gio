/**
 * Render the dashboard portfolio overview, manage refresh progress, and keep cached frontend state in sync.
 */

// Require authentication
if (!requireAuth()) {
    throw new Error('Not authenticated');
}

// Progress state
let initialPortfolioTotal = null;
let previousAssetValues = {}; // Map of assetId -> previous total value
let previousCachedTotal = null; // Total from cached portfolio for delta calculation
let runningDelta = 0; // Accumulated delta from individual asset changes
const LAST_UPDATE_KEY = 'portfolioLastUpdate';
const PROGRESS_BANNER_KEY = 'portfolioProgressBanner';
const DASHBOARD_TITLE_BASE = '🕵️‍♂️ Billy Tracker';

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
 * @returns {void}
 */
const completeProgressBanner = (persistState = true) => {
    const banner = document.getElementById('progress_banner');
    banner.classList.add('completed');
    setProgressBarIndeterminate(false);
    document.getElementById('progress_bar').style.width = '100%';
    document.getElementById('progress_title').textContent = formatProgressBannerTitle();
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
        document.getElementById('progress_title').textContent = formatProgressBannerTitle();
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
 * Resolve the ATH face and accessible label from the drawdown percentage.
 * @param {number} distancePercentage - Percentage distance from all-time high.
 * @returns {{ icon: string, label: string }}
 */
const getAthMood = (distancePercentage) => {
    if (distancePercentage >= 0) {
        return { icon: '🤩', label: 'Portfolio at all time high' };
    }

    if (distancePercentage <= -50) {
        return { icon: '😭', label: 'Portfolio is at least 50 percent below all time high' };
    }

    if (distancePercentage <= -35) {
        return { icon: '😢', label: 'Portfolio is between 35 and 50 percent below all time high' };
    }

    if (distancePercentage <= -20) {
        return { icon: '😟', label: 'Portfolio is between 20 and 35 percent below all time high' };
    }

    if (distancePercentage <= -10) {
        return { icon: '😬', label: 'Portfolio is between 10 and 20 percent below all time high' };
    }

    if (distancePercentage <= -2) {
        return { icon: '🙂', label: 'Portfolio is between 2 and 10 percent below all time high' };
    }

    return { icon: '😎', label: 'Portfolio is within 2 percent of all time high' };
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
    const distancePercentage = allTimeHighTotal > 0 ? (distanceAmount / allTimeHighTotal) * 100 : 0;
    const athLabel = escapeHtml(portfolio.allTimeHighLabel || 'current month');
    const mood = getAthMood(isAtAth ? 0 : distancePercentage);

    setDashboardTitle(mood);

    el.className = `overview_value ${isAtAth ? 'positive' : 'negative'}`;

    if (isAtAth) {
        el.innerHTML = `
            <span class="overview_context">At ATH</span>
            <span class="abs_value"> ${formatCompactValue(allTimeHighTotal)}</span>
            <span class="overview_context"> in ${athLabel}</span>
            <span class="overview_face" aria-label="${mood.label}">${mood.icon}</span>
        `;
        return;
    }

    el.innerHTML = `
        <span class="abs_value">${formatCompactValue(distanceAmount)}</span>
        ${renderPercentageValue(`${t(distancePercentage)}%`)}
        <span class="overview_context"> from ATH</span>
        <span class="abs_value"> ${formatCompactValue(allTimeHighTotal)}</span>
        <span class="overview_context"> in ${athLabel}</span>
        <span class="overview_face" aria-label="${mood.label}">${mood.icon}</span>
    `;
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
    let diffHtml = '';
    if (!failed && assetTotal !== null && previousAssetValues[assetId] !== undefined) {
        const prevValue = previousAssetValues[assetId];
        const diff = assetTotal - prevValue;
        runningDelta += diff; // Accumulate delta
        const diffPct = prevValue !== 0 ? (diff / prevValue) * 100 : null;
        const sign = diff >= 0 ? '+' : '';
        const diffClass = diff >= 0 ? 'positive' : 'negative';
        const diffPctLabel = diffPct === null ? '—' : `${sign}${t(diffPct)}%`;
        latestAssetDiff = { diff, diffPct, sign, diffClass };
        diffHtml = `<span class="asset_diff ${diffClass}"><span class="abs_value">${sign}€${formatCompactValue(diff)}</span>${renderPercentageValue(diffPctLabel)}</span>`;
    }

    // Append asset to list
    const valueDisplay = failed 
        ? '<span class="asset_value failed">❌ Failed</span>'
        : `<span class="asset_value"><span class="abs_value">€${formatCompactValue(assetTotal || 0)} ✓</span><span class="pct_value pct_placeholder">—</span></span>${diffHtml}`;
    
    const assetRow = document.createElement('div');
    assetRow.className = 'progress_asset_row';
    assetRow.setAttribute('data-testid', `progress-asset-${String(assetId).replaceAll(/[^a-zA-Z0-9_-]+/g, '-')}`);
    assetRow.innerHTML = `<span class="asset_name">${assetName}</span><span>${valueDisplay}</span>`;
    
    const listEl = document.getElementById('progress_assets_list');
    listEl.appendChild(assetRow);
    // Auto-scroll to bottom
    listEl.scrollTop = listEl.scrollHeight;

    // Update portfolio delta using the current asset's previous value as the percentage baseline.
    if (latestAssetDiff) {
        const { diffPct, sign: assetSign } = latestAssetDiff;
        const runningSign = runningDelta >= 0 ? '+' : '';
        const emoji = runningDelta >= 0 ? '🚀' : '🔥';
        const deltaPctLabel = diffPct === null ? '—' : `${assetSign}${t(diffPct)}%`;
        
        const deltaEl = document.getElementById('progress_delta');
        deltaEl.innerHTML = `<span class="abs_value">${runningSign}€${formatCompactValue(runningDelta)}</span>${renderPercentageValue(deltaPctLabel)} ${emoji}`;
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
        const cachedPortfolio = JSON.parse(localStorage.getItem('portfolio') || 'null');
        initialPortfolioTotal = cachedPortfolio?.total || null;
        previousCachedTotal = cachedPortfolio?.total || null;
        
        // Build map of assetId -> previous total value from cached portfolio
        previousAssetValues = {};
        if (cachedPortfolio) {
            const viewGroups = Object.keys(cachedPortfolio).filter(k => 
                cachedPortfolio[k] && typeof cachedPortfolio[k] === 'object' && cachedPortfolio[k].details
            );
            for (const group of viewGroups) {
                const details = cachedPortfolio[group].details || {};
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
                localStorage.setItem('portfolio', JSON.stringify(portfolio));
                setLastUpdateNow();
                if (fallbackLoadingMessage) {
                    hideProgressBanner();
                }
                resolve(portfolio);
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

            localStorage.setItem('portfolio', JSON.stringify(portfolio));
            setLastUpdateNow();
            completeProgressBanner(persistCompletedBanner);
            refreshButton.disabled = false;
            refreshButton.innerHTML = originalLabel;
            resolve(portfolio);
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
 * Render one dashboard category card with its nested asset rows.
 * @param {string} categoryKey - View-group name.
 * @param {{ total: number, details?: Record<string, { total: number, displayName?: string }> }} categoryData - Category totals.
 * @param {number} portfolioTotal - Whole-portfolio total.
 * @returns {string}
 */
const renderCategoryRow = (categoryKey, categoryData, portfolioTotal) => {
    if (!categoryData) return '';

    const categoryPct = pct(categoryData.total, portfolioTotal);
    let mainRowValueHtml = `<span class="abs_value">${formatCompactValue(categoryData.total)}</span>${renderPercentageValue(`${categoryPct}%`)}`;
    const formatDetailValue = (value) => categoryKey === 'Crypto'
        ? formatPreciseValue(value)
        : formatCompactValue(value);

    // Render subrows for details using displayName from API
    let subrowsHtml = '';
    if (categoryData.details) {
        for (const [key, detail] of Object.entries(categoryData.details)) {
            const label = detail.displayName || key;
            const assetPct = pct(detail.total, portfolioTotal);
            subrowsHtml += `
                <div class="subrow">
                    <div class="subrow_title">${label}:</div>
                    <div class="subrow_value"><span class="abs_value">${formatDetailValue(detail.total)}</span>${renderPercentageValue(`${assetPct}%`)}</div>
                </div>
            `;
        }
    }

    return `
        <div class="row group_row" style="${getCategoryCardStyle(categoryKey)}">
            <div class="mainrow">
                <div class="row_title">${categoryKey}:</div>
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

    const viewGroupsOrder = Array.isArray(portfolio.viewGroups) && portfolio.viewGroups.length
        ? portfolio.viewGroups
        : Object.keys(portfolio).filter(k => portfolio[k] && typeof portfolio[k] === 'object' && typeof portfolio[k].total === 'number');

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
    let portfolio = JSON.parse(localStorage.getItem('portfolio') || null) || null;
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
                localStorage.setItem('portfolio', JSON.stringify(newPortfolio));
                setLastUpdateNow();
                return newPortfolio;
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
                localStorage.setItem('portfolio', JSON.stringify(resolvedPortfolio));
                setLastUpdateNow();
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
                localStorage.setItem('portfolio', JSON.stringify(migrated));
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
    let portfolio = JSON.parse(localStorage.getItem('portfolio') || null);
    if (portfolio) {
        renderPortfolioData(portfolio);
    }

    // Fetch new data if needed
    portfolio = await getPortfolio(refresh);
    portfolio = await mergeViewGroupsIntoPortfolio(portfolio);
    renderPortfolioData(portfolio);
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
    renderAthDistance(portfolio);
    renderLastUpdate();

    // Show/hide error banner based on failures
    const errorBanner = document.getElementById('error_banner');
    const errorList = document.getElementById('error_list');
    if (portfolio.failures && portfolio.failures.length > 0) {
        errorList.innerHTML = portfolio.failures.join(', ') + ' (using cached values if available)';
        errorBanner.classList.add('visible');
    } else {
        errorBanner.classList.remove('visible');
    }

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
    const cached = JSON.parse(localStorage.getItem('portfolio') || 'null');
    if (cached) {
        renderPortfolioData(cached);
    }
});

// Initialize on page load
setDashboardTitle();
renderLastUpdate();
restoreProgressBanner();
renderPortfolio();
