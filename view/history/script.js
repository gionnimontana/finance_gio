// History page script

// Fetch historical data from server
const fetchHistoricalData = async () => {
    const response = await fetch(`${API_BASE}/portfolio/history`);
    const data = await response.json();
    return data;
};

const renderSummaryCards = (historyData) => {
    if (!historyData || historyData.length === 0) return;

    const latest = historyData[historyData.length - 1];
    const monthsBack = 3;
    const baselineIndex = Math.max(0, historyData.length - 1 - monthsBack);
    const baseline = historyData[baselineIndex];
    
    // Current total
    document.getElementById('current_total').innerHTML = `€${t(latest.total)}`;
    
    // Change vs N months back
    const totalChange = latest.total - baseline.total;
    const totalChangePct = ((totalChange / baseline.total) * 100).toFixed(1);
    const changeClass = totalChange >= 0 ? 'positive' : 'negative';
    const changeSign = totalChange >= 0 ? '+' : '';
    document.getElementById('total_change').innerHTML = `${changeSign}€${t(totalChange)} (${changeSign}${totalChangePct}%)`;
    document.getElementById('total_change').className = `summary_card_value ${changeClass}`;
    
    // Average monthly growth over entire history
    const first = historyData[0];
    const totalMonths = historyData.length - 1;
    const totalGrowth = latest.total - first.total;
    const avgMonthlyGrowth = totalGrowth / totalMonths;
    const avgMonthlyGrowthPct = ((avgMonthlyGrowth / first.total) * 100).toFixed(2);
    const avgClass = avgMonthlyGrowth >= 0 ? 'positive' : 'negative';
    const avgSign = avgMonthlyGrowth >= 0 ? '+' : '';
    document.getElementById('avg_growth').innerHTML = `${avgSign}${avgMonthlyGrowthPct}%`;
    document.getElementById('avg_growth').className = `summary_card_value ${avgClass}`;
};

const renderHistory = async () => {
    const historyData = await fetchHistoricalData();
    const schema = await fetchAssetsSchema().catch(() => null);
    const viewGroups = Array.isArray(schema?.viewGroups) ? schema.viewGroups : null;
    
    // Render summary cards
    renderSummaryCards(historyData);
    
    // Render the column chart
    HistoryChartModule.renderColumnChart('history_chart', historyData, viewGroups);
    
    // Render the detailed table
    HistoryChartModule.renderHistoryTable('history_table', historyData, viewGroups);
};

renderHistory();
