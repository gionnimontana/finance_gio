// Dashboard script - Portfolio overview and refresh logic

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

// Show progress banner
const showProgressBanner = () => {
    const banner = document.getElementById('progress_banner');
    banner.classList.add('visible');
    banner.classList.remove('completed');
    document.getElementById('error_banner').classList.remove('visible');
    document.getElementById('progress_bar').style.width = '0%';
    document.getElementById('progress_counter').textContent = '0/0';
    document.getElementById('progress_assets_list').innerHTML = '';
    document.getElementById('progress_delta').textContent = '';
    document.getElementById('progress_delta').className = 'progress_delta';
    document.getElementById('progress_title').textContent = '🔄 Refreshing Portfolio...';
    document.getElementById('progress_close').style.display = 'none';
    runningDelta = 0; // Reset running delta
};

// Hide progress banner
const hideProgressBanner = () => {
    const banner = document.getElementById('progress_banner');
    banner.classList.remove('visible');
    banner.classList.remove('completed');
};

const clearProgressBannerState = () => {
    try {
        localStorage.removeItem(PROGRESS_BANNER_KEY);
    } catch (e) {
        // ignore
    }
};

// Close progress banner (keeps last update timestamp in dashboard card)
const closeProgressBanner = () => {
    hideProgressBanner();
    clearProgressBannerState();
};

// Format date for progress banner title
const formatProgressBannerTitle = () => {
    const raw = localStorage.getItem(LAST_UPDATE_KEY);
    if (!raw) return '✅ Refresh Complete';
    const date = new Date(raw);
    if (Number.isNaN(date.getTime())) return '✅ Refresh Complete';
    return `✅ Updated: ${date.toLocaleString()}`;
};

// Mark progress as complete (keep visible with close button)
const completeProgressBanner = () => {
    const banner = document.getElementById('progress_banner');
    banner.classList.add('completed');
    document.getElementById('progress_title').textContent = formatProgressBannerTitle();
    document.getElementById('progress_close').style.display = 'block';
    
    // Save progress banner state for persistence across page refresh
    saveProgressBannerState();
};

// Save progress banner state to localStorage
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

// Restore progress banner from localStorage
const restoreProgressBanner = () => {
    try {
        const raw = localStorage.getItem(PROGRESS_BANNER_KEY);
        if (!raw) return false;
        
        const state = JSON.parse(raw);
        if (!state || !state.assetsListHtml) return false;
        
        const banner = document.getElementById('progress_banner');
        banner.classList.add('visible');
        banner.classList.add('completed');
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

// Update progress display
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
        diffHtml = `<span class="asset_diff ${diffClass}"><span class="abs_value">${sign}€${t(diff)}</span><span class="pct_value"> (${diffPctLabel})</span></span>`;
    }

    // Append asset to list
    const valueDisplay = failed 
        ? '<span class="asset_value failed">❌ Failed</span>'
        : `<span class="asset_value"><span class="abs_value">€${t(assetTotal || 0)} ✓</span><span class="pct_value pct_placeholder">—</span></span>${diffHtml}`;
    
    const assetRow = document.createElement('div');
    assetRow.className = 'progress_asset_row';
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
        deltaEl.innerHTML = `<span class="abs_value">${runningSign}€${t(runningDelta)}</span><span class="pct_value"> (${deltaPctLabel})</span> ${emoji}`;
        deltaEl.className = 'progress_delta ' + (runningDelta >= 0 ? 'positive' : 'negative');
    }
};

// Stream portfolio refresh using SSE
const streamPortfolioRefresh = () => {
    return new Promise((resolve, reject) => {
        const refreshButton = document.getElementById('refresh_button');
        const originalLabel = refreshButton.innerHTML;
        refreshButton.disabled = true;
        refreshButton.innerHTML = 'Refreshing...';

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

        showProgressBanner();

        const password = getPassword();
        const eventSource = new EventSource(`${API_BASE}/portfolio/stream?password=${encodeURIComponent(password)}`);

        eventSource.addEventListener('progress', (event) => {
            const data = JSON.parse(event.data);
            updateProgress(data);
        });

        eventSource.addEventListener('complete', (event) => {
            const portfolio = JSON.parse(event.data);
            eventSource.close();
            
            completeProgressBanner();
            refreshButton.disabled = false;
            refreshButton.innerHTML = originalLabel;

            localStorage.setItem('portfolio', JSON.stringify(portfolio));
            setLastUpdateNow();
            resolve(portfolio);
        });

        eventSource.addEventListener('error', (event) => {
            // Check if it's a custom error event with data
            if (event.data) {
                console.error('Stream error:', JSON.parse(event.data));
            }
            eventSource.close();
            
            hideProgressBanner();
            refreshButton.disabled = false;
            refreshButton.innerHTML = originalLabel;

            // Fallback to regular fetch on error
            fetchData(true).then(portfolio => {
                localStorage.setItem('portfolio', JSON.stringify(portfolio));
                setLastUpdateNow();
                resolve(portfolio);
            }).catch(reject);
        });

        eventSource.onerror = () => {
            // Connection error - close and fallback
            eventSource.close();
            
            hideProgressBanner();
            refreshButton.disabled = false;
            refreshButton.innerHTML = originalLabel;

            // Fallback to regular fetch
            fetchData(true).then(portfolio => {
                localStorage.setItem('portfolio', JSON.stringify(portfolio));
                setLastUpdateNow();
                resolve(portfolio);
            }).catch(reject);
        };
    });
};

// Function to render a single category row
const renderCategoryRow = (categoryKey, categoryData, portfolioTotal) => {
    if (!categoryData) return '';

    const categoryPct = pct(categoryData.total, portfolioTotal);
    let mainRowValueHtml = `<span class="abs_value">${t(categoryData.total)}</span><span class="pct_value"> (${categoryPct}%)</span>`;

    // Render subrows for details using displayName from API
    let subrowsHtml = '';
    if (categoryData.details) {
        for (const [key, detail] of Object.entries(categoryData.details)) {
            const label = detail.displayName || key;
            const assetPct = pct(detail.total, portfolioTotal);
            subrowsHtml += `
                <div class="subrow">
                    <div class="subrow_title">${label}:</div>
                    <div class="subrow_value"><span class="abs_value">${t(detail.total)}</span><span class="pct_value"> (${assetPct}%)</span></div>
                </div>
            `;
        }
    }

    return `
        <div class="row">
            <div class="mainrow">
                <div class="row_title">${categoryKey}:</div>
                <div class="row_value">${mainRowValueHtml}</div>
            </div>
            ${subrowsHtml}
        </div>
    `;
};

// Function to render the entire table view
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

const fetchData = async (refresh) => {
    const response = await authFetch(`${API_BASE}/portfolio?refresh=` + refresh);
    const data = await response.json();
    return data;
}

const getPortfolio = async (refresh) => {
    let portfolio = JSON.parse(localStorage.getItem('portfolio') || null) || null;
    // Force refresh if displayName is missing or viewGroups are missing (cache from old version)
    const needsRefresh = portfolio && (
        (portfolio.Equity?.details && Object.values(portfolio.Equity.details).some(d => !d.displayName)) ||
        !portfolio.Gold ||
        !portfolio.Equity
    );
    if (portfolio === null || refresh || needsRefresh) {
        if (refresh) {
            // Use SSE streaming for manual refresh
            return await streamPortfolioRefresh();
        } else {
            // Use regular fetch for initial load
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

const mergeViewGroupsIntoPortfolio = async (portfolio) => {
    // Keep older cached portfolio working, but ensure we always render with the latest group labels/order.
    try {
        const schema = await fetchAssetsSchema();
        if (schema && Array.isArray(schema.viewGroups)) {
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

            const migrated = migratePortfolioViewGroups(portfolio, schema.viewGroups);

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
    document.getElementById('total_value').innerHTML = `<span class="abs_value">${t(total)}</span><span class="pct_value pct_placeholder">—</span>`;
    document.getElementById('delta_value').innerHTML = `
        <span class="abs_value">${t(delta)}</span>
        <span class="pct_value"> (${deltaPercentage === null ? '—' : t(deltaPercentage) + '%'})</span>
        ${deltaPercentageLabel}
    `;
    document.getElementById('prevMonth_delta_value').innerHTML = `
        <span class="abs_value">${t(prevMonthdelta)}</span>
        <span class="pct_value"> (${prevMonthdeltaPercentage === null ? '—' : t(prevMonthdeltaPercentage) + '%'})</span>
        ${prevMonthdeltaPercentageLabel}
    `;
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
renderLastUpdate();
restoreProgressBanner();
renderPortfolio();
