/**
 * Render the dashboard pie chart that visualizes portfolio totals by view group.
 */
const ChartModule = (() => {
    // Colors for each viewGroup
    const viewGroupColors = {
        Equity: '#4CAF50',    // Green
        Crypto: '#FF9800',    // Orange
        Liquidity: '#2196F3', // Blue
        Gold: '#FFD700'       // Gold
    };

    const defaultColor = '#9E9E9E'; // Grey for unknown groups

    /**
     * Resolve the display color for a view-group label.
     * @param {string} label - View-group label.
     * @returns {string}
     */
    function getViewGroupColor(label) {
        return viewGroupColors[label] || hashToColor(label) || defaultColor;
    }

    /**
     * Resolve the legend container associated with a chart canvas.
     * @param {string} canvasId - The canvas element ID.
     * @returns {HTMLElement | null}
     */
    function getLegendContainer(canvasId) {
        return document.getElementById(`${canvasId}_legend`);
    }

    /**
     * Remove any previously rendered legend items.
     * @param {HTMLElement | null} legendContainer - The legend host element.
     */
    function clearLegend(legendContainer) {
        if (legendContainer) {
            legendContainer.replaceChildren();
        }
    }

    /**
     * Render the legend items below the chart using DOM nodes instead of the canvas.
     * @param {HTMLElement | null} legendContainer - The legend host element.
     * @param {Array<{label: string, value: number, color: string}>} data - Pie slices.
     * @param {number} total - Sum of all slice values.
     */
    function renderLegend(legendContainer, data, total) {
        if (!legendContainer) return;

        const legendItems = data.map(item => {
            const percentage = ((item.value / total) * 100).toFixed(1);
            const itemElement = document.createElement('div');
            itemElement.className = 'chart_legend_item';

            const swatchElement = document.createElement('span');
            swatchElement.className = 'chart_legend_swatch';
            swatchElement.style.backgroundColor = item.color;
            itemElement.appendChild(swatchElement);

            const labelElement = document.createElement('span');
            labelElement.className = 'chart_legend_label';
            labelElement.textContent = `${item.label}: ${percentage}%`;
            itemElement.appendChild(labelElement);

            return itemElement;
        });

        legendContainer.replaceChildren(...legendItems);
    }

    /**
     * Generate a deterministic fallback color for dynamic or unknown view-group labels.
     * @param {string} label - View-group label.
     * @returns {string}
     */
    const hashToColor = (label) => {
        // Deterministic, pleasant-ish HSL color from a string label
        const str = String(label || '');
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) - hash) + str.charCodeAt(i);
            hash |= 0;
        }
        const hue = Math.abs(hash) % 360;
        return `hsl(${hue}, 65%, 55%)`;
    };

    /**
     * Render a pie chart showing viewGroup distribution
     * @param {string} canvasId - The ID of the canvas element
     * @param {Object} portfolio - The portfolio data with viewGroup totals
     */
    const renderPieChart = (canvasId, portfolio) => {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const legendContainer = getLegendContainer(canvasId);
        const ctx = canvas.getContext('2d');
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 20;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        clearLegend(legendContainer);

        const viewGroups = Array.isArray(portfolio?.viewGroups) && portfolio.viewGroups.length
            ? portfolio.viewGroups
            : Object.keys(portfolio).filter(k => portfolio[k] && typeof portfolio[k] === 'object' && typeof portfolio[k].total === 'number');

        const data = viewGroups
            .filter(group => portfolio[group] && portfolio[group].total > 0)
            .map(group => ({
                label: group,
                value: portfolio[group].total,
                color: getViewGroupColor(group)
            }));

        if (data.length === 0) return;

        const total = data.reduce((sum, item) => sum + item.value, 0);

        // Draw pie slices
        let startAngle = -Math.PI / 2; // Start from top

        data.forEach(item => {
            const sliceAngle = (item.value / total) * 2 * Math.PI;
            const endAngle = startAngle + sliceAngle;

            // Draw slice
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, endAngle);
            ctx.closePath();
            ctx.fillStyle = item.color;
            ctx.fill();

            // Draw slice border
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();

            startAngle = endAngle;
        });

        renderLegend(legendContainer, data, total);
    };

    return {
        renderPieChart,
        getViewGroupColor,
        viewGroupColors
    };
})();
