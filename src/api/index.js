const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const HISTORICAL_DATA_PATH = path.join(DATA_DIR, 'historicalData.json');
const ASSETS_SCHEMA_PATH = path.join(DATA_DIR, 'assetsSchema.json');

// Default assets schema used when JSON file doesn't exist
const DEFAULT_ASSETS_SCHEMA = {
    assets: [],
    prevMonthTotal: null,
    initYearNetworth: null
};

// Default historical data used when JSON file doesn't exist
const DEFAULT_HISTORICAL_DATA = [];

const getAssetsSchema = async () => {
    try {
        if (fs.existsSync(ASSETS_SCHEMA_PATH)) {
            const data = fs.readFileSync(ASSETS_SCHEMA_PATH, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error reading assets schema file:', error);
    }
    
    // Create file with default data if it doesn't exist
    try {
        fs.writeFileSync(ASSETS_SCHEMA_PATH, JSON.stringify(DEFAULT_ASSETS_SCHEMA, null, 2), 'utf8');
        console.log('Created new assets schema file with default data');
    } catch (error) {
        console.error('Error creating assets schema file:', error);
    }
    
    return DEFAULT_ASSETS_SCHEMA;
}

const writeAssetsSchema = async (assetsSchema) => {
    try {
        fs.writeFileSync(ASSETS_SCHEMA_PATH, JSON.stringify(assetsSchema, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Error writing assets schema file:', error);
        return false;
    }
}

const ALLOWED_ASSET_CLASSES = ['Isin', 'Gold', 'Crypto', 'Other'];

const normalizeAssetClass = (assetClass) => {
    const c = String(assetClass || '').trim();
    if (ALLOWED_ASSET_CLASSES.includes(c)) return c;
    // legacy/support classes become Other
    return 'Other';
}

const normalizeAssetRow = (asset) => {
    if (!Array.isArray(asset) || asset.length !== 5) return asset;
    const [assetClass, assetId, quantity, displayName, viewGroup] = asset;
    return [normalizeAssetClass(assetClass), assetId, quantity, displayName, viewGroup];
}

const isValidAssetRow = (asset) => {
    // Schema: [assetClass, assetId, quantity, displayName, viewGroup]
    if (!Array.isArray(asset) || asset.length !== 5) return false;
    const [assetClass, assetId, quantity, displayName, viewGroup] = asset;
    if (typeof assetClass !== 'string' || assetClass.trim() === '') return false;
    if (!ALLOWED_ASSET_CLASSES.includes(assetClass.trim())) return false;
    if (typeof assetId !== 'string' || assetId.trim() === '') return false;
    if (typeof quantity !== 'number' || Number.isNaN(quantity)) return false;
    if (typeof displayName !== 'string' || displayName.trim() === '') return false;
    if (typeof viewGroup !== 'string' || viewGroup.trim() === '') return false;
    return true;
}

const normalizeAssetsSchema = (schema) => {
    const base = {
        assets: [],
        prevMonthTotal: null,
        initYearNetworth: null
    };

    if (!schema || typeof schema !== 'object') return base;
    return {
        assets: Array.isArray(schema.assets) ? schema.assets : [],
        prevMonthTotal: schema.prevMonthTotal ?? null,
        initYearNetworth: schema.initYearNetworth ?? null,
    };
}

// Replace assets array with provided one (preserves prevMonthTotal/initYearNetworth)
const updateAssetsSchema = async ({ assets }) => {
    if (!Array.isArray(assets)) {
        return { ok: false, error: 'Invalid payload: assets must be an array' };
    }

    // Normalize legacy assetClass values to the new enum.
    const normalizedAssets = assets.map(normalizeAssetRow);

    const invalidIndex = normalizedAssets.findIndex(a => !isValidAssetRow(a));
    if (invalidIndex !== -1) {
        return { ok: false, error: `Invalid asset row at index ${invalidIndex}` };
    }

    const assetIds = normalizedAssets.map(a => String(a[1]));
    const duplicates = assetIds.filter((id, idx) => assetIds.indexOf(id) !== idx);
    if (duplicates.length) {
        return { ok: false, error: `Duplicate assetId(s): ${Array.from(new Set(duplicates)).join(', ')}` };
    }

    const existing = normalizeAssetsSchema(await getAssetsSchema());
    const next = {
        ...existing,
    assets: normalizedAssets
    };
    const wrote = await writeAssetsSchema(next);
    if (!wrote) return { ok: false, error: 'Failed to persist assets schema' };
    return { ok: true, assetsSchema: next };
}

// Historical data for portfolio history view
// Format: array of monthly snapshots with viewGroup totals
const getHistoricalData = async () => {
    try {
        if (fs.existsSync(HISTORICAL_DATA_PATH)) {
            const data = fs.readFileSync(HISTORICAL_DATA_PATH, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error reading historical data file:', error);
    }
    
    // Create file with default data if it doesn't exist
    try {
        fs.writeFileSync(HISTORICAL_DATA_PATH, JSON.stringify(DEFAULT_HISTORICAL_DATA, null, 2), 'utf8');
        console.log('Created new historical data file with default data');
    } catch (error) {
        console.error('Error creating historical data file:', error);
    }
    
    return DEFAULT_HISTORICAL_DATA;
}

// Update prevMonthTotal in assets schema based on historical data
// Gets the total from the previous month's entry in historical data
const updatePrevMonthTotal = async () => {
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = prevMonth.getFullYear();
    const month = String(prevMonth.getMonth() + 1).padStart(2, '0');
    const prevMonthDate = `${year}-${month}`;
    
    const historicalData = await getHistoricalData();
    const prevMonthEntry = historicalData.find(entry => entry.date === prevMonthDate);
    
    // If no previous month data exists, leave prevMonthTotal empty (null)
    const prevMonthTotal = prevMonthEntry ? Math.round(prevMonthEntry.total) : null;
    
    // Update assets schema with prevMonthTotal
    const assetsSchema = await getAssetsSchema();
    assetsSchema.prevMonthTotal = prevMonthTotal;
    
    try {
        fs.writeFileSync(ASSETS_SCHEMA_PATH, JSON.stringify(assetsSchema, null, 2), 'utf8');
        console.log(`Updated prevMonthTotal to ${prevMonthTotal}`);
    } catch (error) {
        console.error('Error updating prevMonthTotal:', error);
    }
    
    return prevMonthTotal;
}

// Update initYearNetworth in assets schema based on historical data
// Gets the total from December of the previous year
const updateInitYearNetworth = async () => {
    const now = new Date();
    const prevYear = now.getFullYear() - 1;
    const decemberDate = `${prevYear}-12`;
    
    const historicalData = await getHistoricalData();
    const decemberEntry = historicalData.find(entry => entry.date === decemberDate);
    
    // If no December data exists, leave initYearNetworth empty (null)
    const initYearNetworth = decemberEntry ? Math.round(decemberEntry.total) : null;
    
    // Update assets schema with initYearNetworth
    const assetsSchema = await getAssetsSchema();
    assetsSchema.initYearNetworth = initYearNetworth;
    
    try {
        fs.writeFileSync(ASSETS_SCHEMA_PATH, JSON.stringify(assetsSchema, null, 2), 'utf8');
        console.log(`Updated initYearNetworth to ${initYearNetworth}`);
    } catch (error) {
        console.error('Error updating initYearNetworth:', error);
    }
    
    return initYearNetworth;
}

// Update historical data with current month's portfolio values
// portfolio should have: total, Liquidity, Crypto, Equity, Gold, Houses (with .total for each)
const updateHistoricalData = async (portfolio) => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = `${year}-${month}`;
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const label = `${monthNames[now.getMonth()]} ${year}`;
    
    // Create the new month entry from portfolio data
    const newEntry = {
        label,
        date,
        total: Math.round(portfolio.total * 100) / 100,
        Liquidity: { total: Math.round((portfolio.Liquidity?.total || 0) * 100) / 100 },
        Crypto: { total: Math.round((portfolio.Crypto?.total || 0) * 100) / 100 },
        Houses: { total: Math.round((portfolio.Houses?.total || 0) * 100) / 100 },
        Equity: { total: Math.round((portfolio.Equity?.total || 0) * 100) / 100 },
        Gold: { total: Math.round((portfolio.Gold?.total || 0) * 100) / 100 },
    };
    
    // Get current historical data
    let historicalData = await getHistoricalData();
    
    // Find if current month already exists
    const existingIndex = historicalData.findIndex(entry => entry.date === date);
    
    if (existingIndex !== -1) {
        // Update existing entry
        historicalData[existingIndex] = newEntry;
    } else {
        // Add new entry
        historicalData.push(newEntry);
        // Sort by date to maintain chronological order
        historicalData.sort((a, b) => a.date.localeCompare(b.date));
    }
    
    // Save to file
    try {
        fs.writeFileSync(HISTORICAL_DATA_PATH, JSON.stringify(historicalData, null, 2), 'utf8');
        console.log(`Historical data updated for ${label}`);
    } catch (error) {
        console.error('Error writing historical data file:', error);
    }
    
    return historicalData;
}

module.exports = {
    getAssetsSchema,
    updateAssetsSchema,
    getHistoricalData,
    updateHistoricalData,
    updatePrevMonthTotal,
    updateInitYearNetworth,
}
