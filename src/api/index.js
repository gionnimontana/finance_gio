const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'data');
const HISTORICAL_DATA_PATH = path.join(DATA_DIR, 'historicalData.json');
const ASSETS_SCHEMA_PATH = path.join(DATA_DIR, 'assetsSchema.json');

// Default assets schema used when JSON file doesn't exist
const DEFAULT_ASSETS_SCHEMA = {
    assets: [],
    viewGroups: ['Liquidity', 'Crypto', 'Gold', 'Equity'],
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

const writeHistoricalData = async (historicalData) => {
    try {
        fs.writeFileSync(HISTORICAL_DATA_PATH, JSON.stringify(historicalData, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Error writing historical data file:', error);
        return false;
    }
}

const ALLOWED_ASSET_CLASSES = ['Isin', 'Gold', 'Crypto', 'Other'];

const DEFAULT_VIEW_GROUPS = ['Liquidity', 'Crypto', 'Gold', 'Houses', 'Equity'];
 
const normalizeViewGroupName = (name) => {
    const n = String(name ?? '').trim();
    return n;
}

const uniqStrings = (arr) => {
    const out = [];
    const seen = new Set();
    for (const v of arr) {
        const s = String(v);
        if (!seen.has(s)) {
            seen.add(s);
            out.push(s);
        }
    }
    return out;
}

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
        viewGroups: DEFAULT_VIEW_GROUPS,
        prevMonthTotal: null,
        initYearNetworth: null
    };

    if (!schema || typeof schema !== 'object') return base;
    return {
        assets: Array.isArray(schema.assets) ? schema.assets : [],
        viewGroups: Array.isArray(schema.viewGroups) ? schema.viewGroups : DEFAULT_VIEW_GROUPS,
        prevMonthTotal: schema.prevMonthTotal ?? null,
        initYearNetworth: schema.initYearNetworth ?? null,
    };
}

const computeViewGroupsFromAssets = (assets) => {
    const groups = [];
    for (const a of assets) {
        if (Array.isArray(a) && a.length === 5) {
            groups.push(String(a[4] ?? '').trim());
        }
    }
    return uniqStrings(groups.filter(Boolean));
}

const validateViewGroupsPayload = (viewGroups) => {
    if (!Array.isArray(viewGroups)) return { ok: false, error: 'Invalid payload: viewGroups must be an array' };
    const normalized = viewGroups.map(normalizeViewGroupName).filter(Boolean);
    if (!normalized.length) return { ok: false, error: 'Invalid payload: viewGroups must contain at least 1 group' };
    const unique = uniqStrings(normalized);
    // forbid commas/empty-ish already handled; keep names reasonably safe
    const invalid = unique.find(g => g.length > 40);
    if (invalid) return { ok: false, error: `Invalid viewGroup '${invalid}': too long (max 40 chars)` };
    return { ok: true, viewGroups: unique };
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
        assets: normalizedAssets,
        // Keep any existing viewGroups but ensure groups referenced by assets always exist
        viewGroups: uniqStrings([
            ...(Array.isArray(existing.viewGroups) ? existing.viewGroups : DEFAULT_VIEW_GROUPS).map(normalizeViewGroupName).filter(Boolean),
            ...computeViewGroupsFromAssets(normalizedAssets)
        ])
    };
    const wrote = await writeAssetsSchema(next);
    if (!wrote) return { ok: false, error: 'Failed to persist assets schema' };
    return { ok: true, assetsSchema: next };
}

// Replace viewGroups array (cannot remove groups that are referenced by any asset)
const updateViewGroups = async ({ viewGroups }) => {
    const existing = normalizeAssetsSchema(await getAssetsSchema());

    const validation = validateViewGroupsPayload(viewGroups);
    if (!validation.ok) return { ok: false, error: validation.error };

    const referenced = computeViewGroupsFromAssets(existing.assets);
    const nextGroups = validation.viewGroups;

    // If the user is renaming a group, we treat it as:
    // - one removed name
    // - one added name
    // and automatically migrate assets + historical snapshots.
    // (This keeps UX simple and avoids a hard error during rename.)
    const added = nextGroups.filter(g => !existing.viewGroups.includes(g));
    const removed = existing.viewGroups.filter(g => !nextGroups.includes(g));

    const missingReferenced = referenced.filter(g => !nextGroups.includes(g));
    const isSimpleRename = missingReferenced.length === 1 && added.length === 1;

    let migratedAssets = existing.assets;
    let historicalData = await getHistoricalData();

    if (missingReferenced.length && isSimpleRename) {
        const from = missingReferenced[0];
        const to = added[0];

        // migrate assets schema
        migratedAssets = existing.assets.map(a => {
            if (!Array.isArray(a) || a.length !== 5) return a;
            if (String(a[4]).trim() !== from) return a;
            return [a[0], a[1], a[2], a[3], to];
        });

        // migrate historical snapshots: move {from:{total}} bucket into {to:{total}}
        if (Array.isArray(historicalData)) {
            historicalData = historicalData.map(entry => {
                if (!entry || typeof entry !== 'object') return entry;
                if (!Object.prototype.hasOwnProperty.call(entry, from)) return entry;

                const fromObj = entry[from];
                const fromTotal = (fromObj && typeof fromObj.total === 'number') ? fromObj.total : 0;

                const nextEntry = { ...entry };
                const existingToObj = nextEntry[to];
                const toTotal = (existingToObj && typeof existingToObj.total === 'number') ? existingToObj.total : 0;
                nextEntry[to] = { total: toTotal + fromTotal };
                delete nextEntry[from];
                return nextEntry;
            });
        }
    } else if (missingReferenced.length) {
        // Not a simple rename: still forbid removing groups that are used.
        return {
            ok: false,
            error: `Cannot remove view group(s) in use: ${missingReferenced.join(', ')}`
        };
    }

    const next = {
        ...existing,
        assets: migratedAssets,
        viewGroups: nextGroups
    };

    const wroteSchema = await writeAssetsSchema(next);
    if (!wroteSchema) return { ok: false, error: 'Failed to persist assets schema' };

    const wroteHistory = await writeHistoricalData(historicalData);
    if (!wroteHistory) return { ok: false, error: 'Failed to persist historical data' };

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
    updateViewGroups,
    getHistoricalData,
    updateHistoricalData,
    updatePrevMonthTotal,
    updateInitYearNetworth,
}
