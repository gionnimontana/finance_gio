/**
 * Render history charts and tables for monthly portfolio data grouped by view group.
 */
const HistoryChartModule = (() => {
    const defaultColor = '#9E9E9E'; // Grey for unknown groups
    let viewGroupColors = {};

    /**
     * Set the saved color map used by the history chart and monthly table.
     * @param {Record<string, string>|null|undefined} colors - Saved group-color map.
     * @returns {void}
     */
    const setViewGroupColors = (colors) => {
        viewGroupColors = colors && typeof colors === 'object' && !Array.isArray(colors) ? { ...colors } : {};
    };

    /**
     * Resolve the configured display color for one view group.
     * @param {string} label - View-group label.
     * @returns {string}
     */
    const getViewGroupColor = (label) => (typeof resolveViewGroupColor === 'function'
        ? resolveViewGroupColor(label, viewGroupColors)
        : viewGroupColors[label] || defaultColor);

    /**
     * Infer view-group keys from the historical dataset when schema data is unavailable.
     * @param {Array<object>} historyData - Historical monthly snapshots.
     * @returns {string[]}
     */
    const inferViewGroupsFromHistory = (historyData) => {
        const keys = new Set();
        (historyData || []).forEach(m => {
            if (!m || typeof m !== 'object') return;
            Object.keys(m).forEach(k => {
                if (k === 'label' || k === 'date' || k === 'total') return;
                if (m[k] && typeof m[k] === 'object' && typeof m[k].total === 'number') keys.add(k);
            });
        });
        return Array.from(keys);
    };

    /**
     * Render a stacked column chart showing monthly viewGroup distribution
     * @param {string} canvasId - The ID of the canvas element
     * @param {Array} historyData - Array of monthly portfolio snapshots
     * @param {string[]} [viewGroupsOverride] - Optional explicit view-group order.
     */
    const renderColumnChart = (canvasId, historyData, viewGroupsOverride) => {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const hideAbsolute = typeof window.isAbsoluteHidden === 'function' && window.isAbsoluteHidden();
        const padding = { top: 40, right: 30, bottom: 120, left: 80 };
        const chartWidth = canvas.width - padding.left - padding.right;
        const chartHeight = canvas.height - padding.top - padding.bottom;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Bottom -> top stacking order
        const detected = inferViewGroupsFromHistory(historyData);
        const viewGroups = Array.isArray(viewGroupsOverride) && viewGroupsOverride.length
            ? viewGroupsOverride
            : (detected.length ? detected : ['Liquidity', 'Crypto', 'Gold', 'Houses', 'Equity']);

        // Stable stacking: keep existing order when provided, else sort detected list
        if (!(Array.isArray(viewGroupsOverride) && viewGroupsOverride.length) && detected.length) {
            viewGroups.sort((a, b) => a.localeCompare(b));
        }
        const numMonths = historyData.length;
        const columnWidth = Math.min(60, (chartWidth / numMonths) * 0.7);
        const columnSpacing = (chartWidth - (columnWidth * numMonths)) / (numMonths + 1);

        // Calculate max total for scaling
        const maxTotal = Math.max(...historyData.map(month => month.total));
        const scale = chartHeight / maxTotal;

        // Draw axes
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.beginPath();
        // Y-axis
        ctx.moveTo(padding.left, padding.top);
        ctx.lineTo(padding.left, padding.top + chartHeight);
        // X-axis
        ctx.lineTo(padding.left + chartWidth, padding.top + chartHeight);
        ctx.stroke();

        // Draw Y-axis labels and grid lines
        ctx.fillStyle = '#333';
        ctx.font = '12px Arial';
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';

        const yTicks = 5;
        for (let i = 0; i <= yTicks; i++) {
            const value = (maxTotal / yTicks) * i;
            const y = padding.top + chartHeight - (value * scale);

            // Grid line
            ctx.strokeStyle = '#e0e0e0';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(padding.left, y);
            ctx.lineTo(padding.left + chartWidth, y);
            ctx.stroke();

            // Label
            if (!hideAbsolute) {
                ctx.fillStyle = '#333';
                const labelValue = formatCompactValue(value, 0, { forceCompact: true, includeCurrency: false });
                ctx.fillText(labelValue, padding.left - 10, y);
            }
        }

        // Draw columns
        historyData.forEach((month, index) => {
            const x = padding.left + columnSpacing + (index * (columnWidth + columnSpacing));
            let currentY = padding.top + chartHeight;

            // Draw stacked segments for each viewGroup
            viewGroups.forEach(group => {
                if (month[group] && month[group].total > 0) {
                    const segmentHeight = month[group].total * scale;
                    const color = getViewGroupColor(group);

                    ctx.fillStyle = color;
                    ctx.fillRect(x, currentY - segmentHeight, columnWidth, segmentHeight);

                    // Border
                    ctx.strokeStyle = '#fff';
                    ctx.lineWidth = 1;
                    ctx.strokeRect(x, currentY - segmentHeight, columnWidth, segmentHeight);

                    currentY -= segmentHeight;
                }
            });

            // Draw month label (rotate to keep readable with many datapoints)
            ctx.save();
            ctx.fillStyle = '#333';
            ctx.font = '11px Arial';
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            const labelX = x + (columnWidth / 2);
            const labelY = padding.top + chartHeight + 10;
            ctx.translate(labelX, labelY);
            ctx.rotate(-Math.PI / 4);
            ctx.fillText(month.label, 0, 0);
            ctx.restore();

            // Draw total value on top of column
            if (!hideAbsolute) {
                ctx.fillStyle = '#333';
                ctx.font = 'bold 11px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                const totalLabel = formatCompactValue(month.total, 1, { forceCompact: true, includeCurrency: false });
                ctx.fillText(totalLabel, x + columnWidth / 2, currentY - 5);
            }
        });

        // Draw legend
        const legendStartX = padding.left;
        const legendY = canvas.height - 30;
        const boxSize = 15;
        let legendX = legendStartX;

        viewGroups.forEach(group => {
            const color = getViewGroupColor(group);

            // Color box
            ctx.fillStyle = color;
            ctx.fillRect(legendX, legendY, boxSize, boxSize);
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
            ctx.strokeRect(legendX, legendY, boxSize, boxSize);

            // Label
            ctx.fillStyle = '#333';
            ctx.font = '12px Arial';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(group, legendX + boxSize + 5, legendY + boxSize / 2);

            legendX += boxSize + ctx.measureText(group).width + 25;
        });

        // Chart title
        ctx.fillStyle = '#333';
        ctx.font = 'bold 16px Arial';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText('Portfolio History by Month', canvas.width / 2, 10);
    };

    /**
     * Render a detailed table showing monthly breakdown
     * @param {string} containerId - The ID of the container element
     * @param {Array} historyData - Array of monthly portfolio snapshots
     * @param {string[]} [viewGroupsOverride] - Optional explicit view-group order.
     */
    const renderHistoryTable = (containerId, historyData, viewGroupsOverride) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        const detected = inferViewGroupsFromHistory(historyData);
        const viewGroups = Array.isArray(viewGroupsOverride) && viewGroupsOverride.length
            ? viewGroupsOverride
            : (detected.length ? detected : ['Liquidity', 'Crypto', 'Gold', 'Houses', 'Equity']);

        if (!(Array.isArray(viewGroupsOverride) && viewGroupsOverride.length) && detected.length) {
            viewGroups.sort((a, b) => a.localeCompare(b));
        }

        /**
         * Calculate a percentage string relative to a total.
         * @param {number} value - Partial value.
         * @param {number} total - Whole value.
         * @returns {string|null}
         */
        const pct = (value, total) => {
            if (!total || total <= 0) return null;
            return ((value / total) * 100).toFixed(1);
        };

        /**
         * Render a percentage span or placeholder for hidden absolute values.
         * @param {number} value - Partial value.
         * @param {number} total - Whole value.
         * @returns {string}
         */
        const pctSpan = (value, total) => {
            const p = pct(value, total);
            return p === null
                ? '<span class="pct_value pct_placeholder">—</span>'
                : renderPercentageValue(`${p}%`);
        };

        let html = '<table class="history_table">';
        
        // Header
        html += '<thead><tr><th>Month</th>';
        viewGroups.forEach(group => {
            // Keep class friendly even with spaces
            const cls = String(group).toLowerCase().replaceAll(/[^a-z0-9]+/g, '-');
            html += `<th class="view_group_column col-${cls}" style="--view-group-color: ${getViewGroupColor(group)};">${group}</th>`;
        });
        html += '<th class="total_column">Total</th><th>Change</th></tr></thead>';

        // Body
        html += '<tbody>';
        historyData.forEach((month, index) => {
            const prevTotal = index > 0 ? historyData[index - 1].total : null;
            const change = prevTotal ? month.total - prevTotal : null;
            const changeClass = change !== null ? (change >= 0 ? 'positive' : 'negative') : '';
            const changeLabel = change !== null 
                ? `<span class="abs_value">${change >= 0 ? '+' : ''}${formatCompactValue(change, 1, { includeCurrency: false })}</span>${renderPercentageValue(`${change >= 0 ? '+' : ''}${pct(change, prevTotal)}%`)}`
                : '-';

            html += `<tr>
                <td class="month_label">${month.label}</td>`;
            
            viewGroups.forEach(group => {
                const value = month[group]?.total || 0;
                const cls = String(group).toLowerCase().replaceAll(/[^a-z0-9]+/g, '-');
                html += `<td class="view_group_column col-${cls}" style="--view-group-color: ${getViewGroupColor(group)};"><span class="abs_value">${formatCompactValue(value, 1, { includeCurrency: false })}</span>${pctSpan(value, month.total)}</td>`;
            });

            html += `<td class="total_cell total_column"><span class="abs_value">${formatCompactValue(month.total)}</span>${pctSpan(month.total, month.total)}</td>
                <td class="change_cell ${changeClass}">${changeLabel}</td>
            </tr>`;
        });
        html += '</tbody></table>';

        container.innerHTML = html;
    };

    return {
        renderColumnChart,
        renderHistoryTable,
        getViewGroupColor,
        setViewGroupColors,
        get viewGroupColors() {
            return { ...viewGroupColors };
        }
    };
})();
