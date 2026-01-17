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

// Mark progress as complete (keep visible with close button)
const completeProgressBanner = () => {
    const banner = document.getElementById('progress_banner');
    banner.classList.add('completed');
    document.getElementById('progress_title').textContent = '✅ Refresh Complete';
    document.getElementById('progress_close').style.display = 'block';
};

// Update progress display
const updateProgress = (data) => {
    const { assetName, assetId, value, assetTotal, failed, index, total, currentPortfolioTotal, prevMonthTotal } = data;
    
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
        const diffPct = prevValue !== 0 ? (diff / prevValue) * 100 : 0;
        const sign = diff >= 0 ? '+' : '';
        const diffClass = diff >= 0 ? 'positive' : 'negative';
        diffHtml = `<span class="asset_diff ${diffClass}">${sign}€${t(diff)} (${sign}${t(diffPct)}%)</span>`;
    }

    // Append asset to list
    const valueDisplay = failed 
        ? '<span class="asset_value failed">❌ Failed</span>'
        : `<span class="asset_value">€${t(assetTotal || 0)} ✓</span>${diffHtml}`;
    
    const assetRow = document.createElement('div');
    assetRow.className = 'progress_asset_row';
    assetRow.innerHTML = `<span class="asset_name">${assetName}</span><span>${valueDisplay}</span>`;
    
    const listEl = document.getElementById('progress_assets_list');
    listEl.appendChild(assetRow);
    // Auto-scroll to bottom
    listEl.scrollTop = listEl.scrollHeight;

    // Update portfolio delta (sum of individual asset changes)
    if (previousCachedTotal) {
        const deltaPercentage = (runningDelta / previousCachedTotal) * 100;
        const sign = runningDelta >= 0 ? '+' : '';
        const emoji = runningDelta >= 0 ? '🚀' : '🔥';
        
        const deltaEl = document.getElementById('progress_delta');
        deltaEl.textContent = `${sign}€${t(runningDelta)} (${sign}${t(deltaPercentage)}%) ${emoji}`;
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
                resolve(portfolio);
            }).catch(reject);
        };
    });
};

// Function to render a single category row
const renderCategoryRow = (categoryKey, categoryData, portfolioTotal) => {
    if (!categoryData) return '';

    const categoryPct = pct(categoryData.total, portfolioTotal);
    let mainRowValueHtml = `${t(categoryData.total)} (${categoryPct}%)`;

    // Render subrows for details using displayName from API
    let subrowsHtml = '';
    if (categoryData.details) {
        for (const [key, detail] of Object.entries(categoryData.details)) {
            const label = detail.displayName || key;
            const assetPct = pct(detail.total, portfolioTotal);
            subrowsHtml += `
                <div class="subrow">
                    <div class="subrow_title">${label}:</div>
                    <div class="subrow_value">${t(detail.total)} (${assetPct}%)</div>
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
    document.getElementById('total_value').innerHTML = t(total);
    document.getElementById('delta_value').innerHTML = `${t(delta)} (${deltaPercentage === null ? '—' : t(deltaPercentage) + '%'}) ${deltaPercentageLabel}`;
    document.getElementById('prevMonth_delta_value').innerHTML = `${t(prevMonthdelta)} (${prevMonthdeltaPercentage === null ? '—' : t(prevMonthdeltaPercentage) + '%'}) ${prevMonthdeltaPercentageLabel}`;

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

// Initialize on page load
renderPortfolio();
