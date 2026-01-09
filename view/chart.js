// Pie Chart for Portfolio View Groups
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
     * Render a pie chart showing viewGroup distribution
     * @param {string} canvasId - The ID of the canvas element
     * @param {Object} portfolio - The portfolio data with viewGroup totals
     */
    const renderPieChart = (canvasId, portfolio) => {
        const canvas = document.getElementById(canvasId);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 20;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Get viewGroup data
        const viewGroups = ['Equity', 'Crypto', 'Liquidity', 'Gold'];
        const data = viewGroups
            .filter(group => portfolio[group] && portfolio[group].total > 0)
            .map(group => ({
                label: group,
                value: portfolio[group].total,
                color: viewGroupColors[group] || defaultColor
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

        // Draw legend
        const legendX = 20;
        let legendY = canvas.height - (data.length * 25) - 10;
        const boxSize = 15;

        data.forEach(item => {
            const percentage = ((item.value / total) * 100).toFixed(1);

            // Color box
            ctx.fillStyle = item.color;
            ctx.fillRect(legendX, legendY, boxSize, boxSize);
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 1;
            ctx.strokeRect(legendX, legendY, boxSize, boxSize);

            // Label
            ctx.fillStyle = '#333';
            ctx.font = '14px Arial';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${item.label}: ${percentage}%`, legendX + boxSize + 10, legendY + boxSize / 2);

            legendY += 25;
        });
    };

    return {
        renderPieChart,
        viewGroupColors
    };
})();
