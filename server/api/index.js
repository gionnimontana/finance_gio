/**
 * Persist, normalize, and update per-user asset schemas and historical portfolio snapshots.
 */
const fs = require('fs');
const path = require('path');
const { getUserDataDir } = require('../auth');

// Default assets schema used when JSON file doesn't exist
const DEFAULT_ASSETS_SCHEMA = {
    assets: [],
    viewGroups: ['Liquidity', 'Crypto', 'Gold', 'Equity'],
    riskOverrides: {},
    prevMonthTotal: null,
    initYearNetworth: null
};

// Default historical data used when JSON file doesn't exist
const DEFAULT_HISTORICAL_DATA = [];

/**
 * Get data file paths for a specific user
 * @param {string} passwordHash - The hashed password identifying the user
 * @returns {{ assetsPath: string, historyPath: string }}
 */
const getUserDataPaths = (passwordHash) => {
    const userDir = getUserDataDir(passwordHash);
    return {
        assetsPath: path.join(userDir, 'assetsSchema.json'),
        historyPath: path.join(userDir, 'historicalData.json')
    };
};

/**
 * Read a user's assets schema from disk, creating the default file when missing.
 * @param {string} passwordHash - The hashed password identifying the user.
 * @returns {Promise<{ assets: unknown[], viewGroups: string[], prevMonthTotal: number|null, initYearNetworth: number|null }>}
 */
const getAssetsSchema = async (passwordHash) => {
    const { assetsPath } = getUserDataPaths(passwordHash);
    try {
        if (fs.existsSync(assetsPath)) {
            const data = fs.readFileSync(assetsPath, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error reading assets schema file:', error);
    }
    
    // Create file with default data if it doesn't exist
    try {
        fs.writeFileSync(assetsPath, JSON.stringify(DEFAULT_ASSETS_SCHEMA, null, 2), 'utf8');
        console.log('Created new assets schema file with default data');
    } catch (error) {
        console.error('Error creating assets schema file:', error);
    }
    
    return DEFAULT_ASSETS_SCHEMA;
}

/**
 * Persist a user's assets schema to disk.
 * @param {string} passwordHash - The hashed password identifying the user.
 * @param {{ assets: unknown[], viewGroups?: string[], prevMonthTotal?: number|null, initYearNetworth?: number|null }} assetsSchema - Schema data to persist.
 * @returns {Promise<boolean>} - Whether the write succeeded.
 */
const writeAssetsSchema = async (passwordHash, assetsSchema) => {
    const { assetsPath } = getUserDataPaths(passwordHash);
    try {
        fs.writeFileSync(assetsPath, JSON.stringify(assetsSchema, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Error writing assets schema file:', error);
        return false;
    }
}

/**
 * Persist a user's historical portfolio snapshots to disk.
 * @param {string} passwordHash - The hashed password identifying the user.
 * @param {Array<object>} historicalData - Monthly historical entries to persist.
 * @returns {Promise<boolean>} - Whether the write succeeded.
 */
const writeHistoricalData = async (passwordHash, historicalData) => {
    const { historyPath } = getUserDataPaths(passwordHash);
    try {
        fs.writeFileSync(historyPath, JSON.stringify(historicalData, null, 2), 'utf8');
        return true;
    } catch (error) {
        console.error('Error writing historical data file:', error);
        return false;
    }
}

const ALLOWED_ASSET_CLASSES = ['Isin', 'Gold', 'Crypto', 'Other'];

const DEFAULT_VIEW_GROUPS = ['Liquidity', 'Crypto', 'Gold', 'Houses', 'Equity'];
 
/**
 * Normalize a candidate view-group name into a trimmed string.
 * @param {unknown} name - Value received from user input or stored data.
 * @returns {string}
 */
const normalizeViewGroupName = (name) => {
    const n = String(name ?? '').trim();
    return n;
}

/**
 * Deduplicate values while preserving their original string order.
 * @param {unknown[]} arr - Values to normalize and de-duplicate.
 * @returns {string[]}
 */
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

/**
 * Map legacy or invalid asset classes into the supported enum.
 * @param {unknown} assetClass - Raw asset class value.
 * @returns {'Isin'|'Gold'|'Crypto'|'Other'}
 */
const normalizeAssetClass = (assetClass) => {
    const c = String(assetClass || '').trim();
    if (ALLOWED_ASSET_CLASSES.includes(c)) return c;
    // legacy/support classes become Other
    return 'Other';
}

/**
 * Normalize a raw asset row into the canonical five-column schema format.
 * @param {unknown} asset - Raw asset row to normalize.
 * @returns {unknown}
 */
const normalizeAssetRow = (asset) => {
    if (!Array.isArray(asset) || asset.length !== 5) return asset;
    const [assetClass, assetId, quantity, displayName, viewGroup] = asset;
    return [normalizeAssetClass(assetClass), assetId, quantity, displayName, viewGroup];
}

/**
 * Keep only per-asset overrides that target current "Other" assets and are valid integer scores.
 * @param {unknown} riskOverrides - Candidate override map.
 * @param {unknown[]} assets - Normalized asset rows.
 * @returns {Record<string, number>}
 */
const sanitizeRiskOverrides = (riskOverrides, assets) => {
    const allowedOtherAssetIds = new Set(
        (Array.isArray(assets) ? assets : [])
            .filter((asset) => Array.isArray(asset) && asset.length === 5 && asset[0] === 'Other')
            .map((asset) => String(asset[1]))
    );

    if (!riskOverrides || typeof riskOverrides !== 'object' || Array.isArray(riskOverrides)) {
        return {};
    }

    return Object.entries(riskOverrides).reduce((acc, [assetId, value]) => {
        if (!allowedOtherAssetIds.has(assetId)) return acc;
        const numericValue = Number(value);
        if (!Number.isInteger(numericValue) || numericValue < 1 || numericValue > 7) return acc;
        acc[assetId] = numericValue;
        return acc;
    }, {});
}

/**
 * Validate and normalize a risk-overrides payload.
 * @param {unknown} riskOverrides - Candidate override map.
 * @param {unknown[]} assets - Normalized asset rows.
 * @returns {{ ok: boolean, error?: string, riskOverrides?: Record<string, number> }}
 */
const validateRiskOverridesPayload = (riskOverrides, assets) => {
    if (!riskOverrides || typeof riskOverrides !== 'object' || Array.isArray(riskOverrides)) {
        return { ok: false, error: 'Invalid payload: riskOverrides must be an object map' };
    }

    const allowedOtherAssetIds = new Set(
        (Array.isArray(assets) ? assets : [])
            .filter((asset) => Array.isArray(asset) && asset.length === 5 && asset[0] === 'Other')
            .map((asset) => String(asset[1]))
    );
    const normalized = {};

    for (const [assetId, value] of Object.entries(riskOverrides)) {
        if (!allowedOtherAssetIds.has(assetId)) {
            return { ok: false, error: `Invalid risk override assetId '${assetId}': only Other assets can be overridden` };
        }
        const numericValue = Number(value);
        if (!Number.isInteger(numericValue) || numericValue < 1 || numericValue > 7) {
            return { ok: false, error: `Invalid risk override for '${assetId}': expected integer 1-7` };
        }
        normalized[assetId] = numericValue;
    }

    return { ok: true, riskOverrides: normalized };
}

/**
 * Validate that an asset row matches the expected schema shape and field types.
 * @param {unknown} asset - Asset row to validate.
 * @returns {boolean}
 */
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

/**
 * Fill missing schema fields with defaults while preserving stored values when valid.
 * @param {unknown} schema - Raw schema object read from disk.
 * @returns {{ assets: unknown[], viewGroups: string[], prevMonthTotal: number|null, initYearNetworth: number|null }}
 */
const normalizeAssetsSchema = (schema) => {
    const base = {
        assets: [],
        viewGroups: DEFAULT_VIEW_GROUPS,
        riskOverrides: {},
        prevMonthTotal: null,
        initYearNetworth: null
    };

    if (!schema || typeof schema !== 'object') return base;
    return {
        assets: Array.isArray(schema.assets) ? schema.assets : [],
        viewGroups: Array.isArray(schema.viewGroups) ? schema.viewGroups : DEFAULT_VIEW_GROUPS,
        riskOverrides: sanitizeRiskOverrides(schema.riskOverrides, Array.isArray(schema.assets) ? schema.assets : []),
        prevMonthTotal: schema.prevMonthTotal ?? null,
        initYearNetworth: schema.initYearNetworth ?? null,
    };
}

/**
 * Build a deterministic cache key from the persisted asset rows and view-group order.
 * @param {unknown} schema - Raw or normalized schema object.
 * @returns {string}
 */
const buildAssetsSchemaCacheKey = (schema) => {
    const normalized = normalizeAssetsSchema(schema);
    return JSON.stringify({
        assets: normalized.assets,
        viewGroups: normalized.viewGroups,
    });
}

/**
 * Collect unique view groups referenced by the current asset rows.
 * @param {unknown[]} assets - Asset rows from the schema.
 * @returns {string[]}
 */
const computeViewGroupsFromAssets = (assets) => {
    const groups = [];
    for (const a of assets) {
        if (Array.isArray(a) && a.length === 5) {
            groups.push(String(a[4] ?? '').trim());
        }
    }
    return uniqStrings(groups.filter(Boolean));
}

/**
 * Validate a proposed view-group list before persisting it.
 * @param {unknown} viewGroups - Candidate view-group payload.
 * @returns {{ ok: boolean, error?: string, viewGroups?: string[] }}
 */
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
/**
 * Replace a user's asset list after normalization, validation, and duplicate checks.
 * @param {string} passwordHash - The hashed password identifying the user.
 * @param {{ assets: unknown[] }} payload - New asset payload.
 * @returns {Promise<{ ok: boolean, error?: string, assetsSchema?: { assets: unknown[], viewGroups: string[], prevMonthTotal: number|null, initYearNetworth: number|null } }>}
 */
const updateAssetsSchema = async (passwordHash, { assets }) => {
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

    const existing = normalizeAssetsSchema(await getAssetsSchema(passwordHash));
    const next = {
        ...existing,
        assets: normalizedAssets,
        // Keep any existing viewGroups but ensure groups referenced by assets always exist
        viewGroups: uniqStrings([
            ...(Array.isArray(existing.viewGroups) ? existing.viewGroups : DEFAULT_VIEW_GROUPS).map(normalizeViewGroupName).filter(Boolean),
            ...computeViewGroupsFromAssets(normalizedAssets)
        ]),
        riskOverrides: sanitizeRiskOverrides(existing.riskOverrides, normalizedAssets)
    };
    const wrote = await writeAssetsSchema(passwordHash, next);
    if (!wrote) return { ok: false, error: 'Failed to persist assets schema' };
    return {
        ok: true,
        assetsSchema: {
            ...next,
            schemaCacheKey: buildAssetsSchemaCacheKey(next)
        }
    };
}

// Replace viewGroups array (cannot remove groups that are referenced by any asset)
/**
 * Replace the stored view groups and migrate dependent data during simple renames.
 * @param {string} passwordHash - The hashed password identifying the user.
 * @param {{ viewGroups: unknown }} payload - Proposed view-group list.
 * @returns {Promise<{ ok: boolean, error?: string, assetsSchema?: { assets: unknown[], viewGroups: string[], prevMonthTotal: number|null, initYearNetworth: number|null } }>}
 */
const updateViewGroups = async (passwordHash, { viewGroups }) => {
    const existing = normalizeAssetsSchema(await getAssetsSchema(passwordHash));

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
    let historicalData = await getHistoricalData(passwordHash);

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

    const wroteSchema = await writeAssetsSchema(passwordHash, next);
    if (!wroteSchema) return { ok: false, error: 'Failed to persist assets schema' };

    const wroteHistory = await writeHistoricalData(passwordHash, historicalData);
    if (!wroteHistory) return { ok: false, error: 'Failed to persist historical data' };

    return {
        ok: true,
        assetsSchema: {
            ...next,
            schemaCacheKey: buildAssetsSchemaCacheKey(next)
        }
    };
}

// Replace riskOverrides map (only Other asset IDs are accepted)
/**
 * Replace the stored risk-override map for Other assets.
 * @param {string} passwordHash - The hashed password identifying the user.
 * @param {{ riskOverrides: unknown }} payload - Candidate override map.
 * @returns {Promise<{ ok: boolean, error?: string, assetsSchema?: { assets: unknown[], viewGroups: string[], riskOverrides: Record<string, number>, prevMonthTotal: number|null, initYearNetworth: number|null } }>}
 */
const updateRiskOverrides = async (passwordHash, { riskOverrides }) => {
    const existing = normalizeAssetsSchema(await getAssetsSchema(passwordHash));
    const validation = validateRiskOverridesPayload(riskOverrides, existing.assets);
    if (!validation.ok) return { ok: false, error: validation.error };

    const next = {
        ...existing,
        riskOverrides: validation.riskOverrides
    };

    const wroteSchema = await writeAssetsSchema(passwordHash, next);
    if (!wroteSchema) return { ok: false, error: 'Failed to persist assets schema' };

    return {
        ok: true,
        assetsSchema: {
            ...next,
            schemaCacheKey: buildAssetsSchemaCacheKey(next)
        }
    };
}

// Historical data for portfolio history view
// Format: array of monthly snapshots with viewGroup totals
/**
 * Read historical monthly portfolio snapshots for a user, creating an empty file when missing.
 * @param {string} passwordHash - The hashed password identifying the user.
 * @returns {Promise<Array<object>>}
 */
const getHistoricalData = async (passwordHash) => {
    const { historyPath } = getUserDataPaths(passwordHash);
    try {
        if (fs.existsSync(historyPath)) {
            const data = fs.readFileSync(historyPath, 'utf8');
            return JSON.parse(data);
        }
    } catch (error) {
        console.error('Error reading historical data file:', error);
    }
    
    // Create file with default data if it doesn't exist
    try {
        fs.writeFileSync(historyPath, JSON.stringify(DEFAULT_HISTORICAL_DATA, null, 2), 'utf8');
        console.log('Created new historical data file with default data');
    } catch (error) {
        console.error('Error creating historical data file:', error);
    }
    
    return DEFAULT_HISTORICAL_DATA;
}

// Update prevMonthTotal in assets schema based on historical data
// Gets the total from the previous month's entry in historical data
/**
 * Derive and persist the previous month's portfolio total inside the assets schema.
 * @param {string} passwordHash - The hashed password identifying the user.
 * @returns {Promise<number|null>} - Rounded previous-month total when available.
 */
const updatePrevMonthTotal = async (passwordHash) => {
    const { assetsPath } = getUserDataPaths(passwordHash);
    const now = new Date();
    const prevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = prevMonth.getFullYear();
    const month = String(prevMonth.getMonth() + 1).padStart(2, '0');
    const prevMonthDate = `${year}-${month}`;
    
    const historicalData = await getHistoricalData(passwordHash);
    const prevMonthEntry = historicalData.find(entry => entry.date === prevMonthDate);
    
    // If no previous month data exists, leave prevMonthTotal empty (null)
    const prevMonthTotal = prevMonthEntry ? Math.round(prevMonthEntry.total) : null;
    
    // Update assets schema with prevMonthTotal
    const assetsSchema = await getAssetsSchema(passwordHash);
    assetsSchema.prevMonthTotal = prevMonthTotal;
    
    try {
        fs.writeFileSync(assetsPath, JSON.stringify(assetsSchema, null, 2), 'utf8');
        console.log(`Updated prevMonthTotal to ${prevMonthTotal}`);
    } catch (error) {
        console.error('Error updating prevMonthTotal:', error);
    }
    
    return prevMonthTotal;
}

// Update initYearNetworth in assets schema based on historical data
// Gets the total from December of the previous year
/**
 * Derive and persist the prior December portfolio total as the current year's baseline.
 * @param {string} passwordHash - The hashed password identifying the user.
 * @returns {Promise<number|null>} - Rounded December total when available.
 */
const updateInitYearNetworth = async (passwordHash) => {
    const { assetsPath } = getUserDataPaths(passwordHash);
    const now = new Date();
    const prevYear = now.getFullYear() - 1;
    const decemberDate = `${prevYear}-12`;
    
    const historicalData = await getHistoricalData(passwordHash);
    const decemberEntry = historicalData.find(entry => entry.date === decemberDate);
    
    // If no December data exists, leave initYearNetworth empty (null)
    const initYearNetworth = decemberEntry ? Math.round(decemberEntry.total) : null;
    
    // Update assets schema with initYearNetworth
    const assetsSchema = await getAssetsSchema(passwordHash);
    assetsSchema.initYearNetworth = initYearNetworth;
    
    try {
        fs.writeFileSync(assetsPath, JSON.stringify(assetsSchema, null, 2), 'utf8');
        console.log(`Updated initYearNetworth to ${initYearNetworth}`);
    } catch (error) {
        console.error('Error updating initYearNetworth:', error);
    }
    
    return initYearNetworth;
}

// Update historical data with current month's portfolio values
// portfolio should have: total, Liquidity, Crypto, Equity, Gold, Houses (with .total for each)
/**
 * Upsert the current month's portfolio totals into historical storage.
 * @param {string} passwordHash - The hashed password identifying the user.
 * @param {{ total: number, Liquidity?: { total: number }, Crypto?: { total: number }, Houses?: { total: number }, Equity?: { total: number }, Gold?: { total: number }, failures?: string[] }} portfolio - Aggregated portfolio totals.
 * @returns {Promise<Array<object>>}
 */
const updateHistoricalData = async (passwordHash, portfolio) => {
    const { historyPath } = getUserDataPaths(passwordHash);
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const date = `${year}-${month}`;
    
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const label = `${monthNames[now.getMonth()]} ${year}`;

    // Keep the last fully successful month snapshot intact when a refresh is partial.
    let historicalData = await getHistoricalData(passwordHash);
    if (Array.isArray(portfolio?.failures) && portfolio.failures.length) {
        return historicalData;
    }
    
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
        fs.writeFileSync(historyPath, JSON.stringify(historicalData, null, 2), 'utf8');
        console.log(`Historical data updated for ${label}`);
    } catch (error) {
        console.error('Error writing historical data file:', error);
    }
    
    return historicalData;
}

module.exports = {
    buildAssetsSchemaCacheKey,
    getAssetsSchema,
    updateAssetsSchema,
    updateViewGroups,
    updateRiskOverrides,
    getHistoricalData,
    updateHistoricalData,
    updatePrevMonthTotal,
    updateInitYearNetworth,
}
