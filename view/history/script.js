/**
 * Fetch and render historical portfolio data, summary cards, and chart/table updates for the history page.
 */

// Require authentication
if (!requireAuth()) {
    throw new Error('Not authenticated');
}

/**
 * Fetch the portfolio history dataset from the backend.
 * @returns {Promise<object[]>}
 */
const fetchHistoricalData = async () => {
    const response = await authFetch(`${API_BASE}/portfolio/history`);
    const data = await response.json();
    return data;
};

/**
 * Render the history summary cards from the loaded monthly data.
 * @param {Array<{ total: number }>} historyData - Historical monthly portfolio snapshots.
 * @returns {void}
 */
const renderSummaryCards = (historyData) => {
    if (!historyData || historyData.length === 0) return;

    const latest = historyData[historyData.length - 1];
    const monthsBack = 3;
    const baselineIndex = Math.max(0, historyData.length - 1 - monthsBack);
    const baseline = historyData[baselineIndex];
    
    // Current total
    document.getElementById('current_total').innerHTML = `<span class="abs_value">€${t(latest.total)}</span><span class="pct_value pct_placeholder">—</span>`;
    
    // Change vs N months back
    const totalChange = latest.total - baseline.total;
    const hasBaseline = typeof baseline.total === 'number' && baseline.total > 0;
    const totalChangePct = hasBaseline ? ((totalChange / baseline.total) * 100).toFixed(1) : null;
    const changeClass = totalChange >= 0 ? 'positive' : 'negative';
    const changeSign = totalChange >= 0 ? '+' : '';
    document.getElementById('total_change').innerHTML = `
        <span class="abs_value">${changeSign}€${t(totalChange)}</span>
        <span class="pct_value"> (${totalChangePct === null ? '—' : changeSign + totalChangePct + '%'})</span>
    `;
    document.getElementById('total_change').className = `summary_card_value ${changeClass}`;
    
    // Average monthly growth over entire history
    const first = historyData[0];
    const totalMonths = historyData.length - 1;
    const totalGrowth = latest.total - first.total;
    const hasHistoryBaseline = typeof first.total === 'number' && first.total > 0 && totalMonths > 0;
    const avgMonthlyGrowth = hasHistoryBaseline ? totalGrowth / totalMonths : null;
    const avgMonthlyGrowthPct = hasHistoryBaseline ? ((avgMonthlyGrowth / first.total) * 100).toFixed(2) : null;
    const avgClass = totalGrowth >= 0 ? 'positive' : 'negative';
    const avgSign = totalGrowth >= 0 ? '+' : '';
    document.getElementById('avg_growth').innerHTML = `<span class="pct_value">${avgMonthlyGrowthPct === null ? '—' : avgSign + avgMonthlyGrowthPct + '%'}</span>`;
    document.getElementById('avg_growth').className = `summary_card_value ${avgClass}`;
};

let cachedHistoryData = null;
let cachedHistoryViewGroups = null;

/**
 * Load history data and render the summary cards, chart, and table.
 * @returns {Promise<void>}
 */
const renderHistory = async () => {
    const historyData = await fetchHistoricalData();
    const schema = await fetchAssetsSchema().catch(() => null);
    const viewGroups = Array.isArray(schema?.viewGroups) ? schema.viewGroups : null;

    cachedHistoryData = historyData;
    cachedHistoryViewGroups = viewGroups;
    
    // Render summary cards
    renderSummaryCards(historyData);
    
    // Render the column chart
    HistoryChartModule.renderColumnChart('history_chart', historyData, viewGroups);
    
    // Render the detailed table
    HistoryChartModule.renderHistoryTable('history_table', historyData, viewGroups);
};

window.addEventListener('absolute-visibility-change', () => {
    if (!cachedHistoryData) return;
    renderSummaryCards(cachedHistoryData);
    HistoryChartModule.renderColumnChart('history_chart', cachedHistoryData, cachedHistoryViewGroups);
    HistoryChartModule.renderHistoryTable('history_table', cachedHistoryData, cachedHistoryViewGroups);
});

renderHistory();
