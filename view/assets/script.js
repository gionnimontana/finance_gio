/**
 * Manage editable asset rows, view groups, and password export controls on the settings page.
 */

// Require authentication
if (!requireAuth()) {
    throw new Error('Not authenticated');
}

let assetsSchema = null;

const ASSET_CLASSES = [
    'Isin',
    'Gold',
    'Crypto',
    'Other'
];

const DEFAULT_VIEW_GROUPS = [
    'Liquidity',
    'Crypto',
    'Gold',
    'Houses',
    'Equity'
];

/**
 * Build an HTML select element from a list of options.
 * @param {string[]} options - Available option labels.
 * @param {string} value - Selected option value.
 * @param {string} onChange - Inline change handler expression.
 * @returns {string}
 */
const renderSelect = (options, value, onChange) => {
    const opts = options.map(o => `<option value="${escapeHtml(o)}" ${o === value ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('');
    return `<select onchange="${onChange}">${opts}</select>`;
};

/**
 * Normalize number-like input values coming from text fields.
 * @param {unknown} value - Raw value from the form.
 * @returns {number}
 */
const normalizeNumber = (value) => {
    if (value === null || value === undefined) return NaN;
    if (typeof value === 'number') return value;
    // allow commas
    const cleaned = String(value).trim().replace(',', '.');
    return Number(cleaned);
};

/**
 * Validate the editable asset rows before saving them to the backend.
 * @param {unknown[]} assets - Asset rows to validate.
 * @returns {string|null} - Validation error message when invalid.
 */
const validateAssets = (assets) => {
    const seen = new Set();
    for (let i = 0; i < assets.length; i++) {
        const a = assets[i];
        if (!Array.isArray(a) || a.length !== 5) {
            return `Row ${i + 1}: invalid shape, expected 5 columns`;
        }
        const [assetClass, assetId, quantity, displayName, viewGroup] = a;
        if (!assetClass || String(assetClass).trim() === '') return `Row ${i + 1}: assetClass is required`;
        if (!assetId || String(assetId).trim() === '') return `Row ${i + 1}: assetId is required`;
        if (seen.has(String(assetId))) return `Row ${i + 1}: duplicate assetId '${assetId}'`;
        seen.add(String(assetId));
        if (typeof quantity !== 'number' || Number.isNaN(quantity)) return `Row ${i + 1}: quantity must be a number`;
        if (!displayName || String(displayName).trim() === '') return `Row ${i + 1}: displayName is required`;
        if (!viewGroup || String(viewGroup).trim() === '') return `Row ${i + 1}: viewGroup is required`;
    }
    return null;
};

/**
 * Enable or disable all settings-page action buttons.
 * @param {boolean} disabled - Whether the buttons should be disabled.
 * @returns {void}
 */
const setButtonsDisabled = (disabled) => {
    el('reload_btn').disabled = disabled;
    el('add_btn').disabled = disabled;
    el('save_btn').disabled = disabled;
    el('groups_reload_btn').disabled = disabled;
    el('groups_add_btn').disabled = disabled;
    el('groups_save_btn').disabled = disabled;
};

/**
 * Resolve the active list of view groups, falling back to defaults when missing.
 * @returns {string[]}
 */
const getViewGroups = () => {
    const groups = assetsSchema?.viewGroups;
    if (Array.isArray(groups) && groups.length) return groups;
    return DEFAULT_VIEW_GROUPS.slice();
};

/**
 * Deduplicate string values while preserving their first occurrence order.
 * @param {unknown[]} arr - Values to normalize and deduplicate.
 * @returns {string[]}
 */
const uniq = (arr) => Array.from(new Set(arr.map(v => String(v))));

/**
 * Count how many assets currently reference each view group.
 * @returns {Record<string, number>}
 */
const getGroupUsageCounts = () => {
    const counts = {};
    const assets = assetsSchema?.assets || [];
    for (const a of assets) {
        if (Array.isArray(a) && a.length === 5) {
            const g = String(a[4] ?? '').trim();
            if (!g) continue;
            counts[g] = (counts[g] || 0) + 1;
        }
    }
    return counts;
};

/**
 * Render the editable asset rows table from the current schema state.
 * @returns {void}
 */
const renderTable = () => {
    const tbody = el('assets_tbody');
    tbody.innerHTML = '';

    const assets = (assetsSchema?.assets || []).slice();
    const viewGroups = getViewGroups();

    assets.forEach((asset, idx) => {
        const [assetClass, assetId, quantity, displayName, viewGroup] = asset;

        const tr = document.createElement('tr');

        const tdClass = document.createElement('td');
        tdClass.innerHTML = renderSelect(ASSET_CLASSES, assetClass, `onAssetChange(${idx}, 0, this.value)`);

        const tdId = document.createElement('td');
        tdId.innerHTML = `<input class="mono" value="${escapeHtml(assetId)}" onchange="onAssetChange(${idx}, 1, this.value)" />`;

        const tdQty = document.createElement('td');
        tdQty.innerHTML = `<input value="${escapeHtml(quantity)}" onchange="onAssetQuantityChange(${idx}, this.value)" />`;

        const tdName = document.createElement('td');
        tdName.innerHTML = `<input value="${escapeHtml(displayName)}" onchange="onAssetChange(${idx}, 3, this.value)" />`;

        const tdGroup = document.createElement('td');
        // Ensure the currently selected group is always available even if schema groups are outdated.
        const vgOptions = uniq([...(viewGroups || []), String(viewGroup || '').trim()].filter(Boolean));
        tdGroup.innerHTML = renderSelect(vgOptions, viewGroup, `onAssetChange(${idx}, 4, this.value)`);

        const tdActions = document.createElement('td');
        tdActions.className = 'actions';
        tdActions.innerHTML = `
            <div class="inline">
                <button class="btn primary" onclick="moveRow(${idx}, -1)" ${idx === 0 ? 'disabled' : ''}>Up</button>
                <button class="btn primary" onclick="moveRow(${idx}, 1)" ${idx === assets.length - 1 ? 'disabled' : ''}>Down</button>
                <button class="btn danger" onclick="deleteRow(${idx})">Delete</button>
            </div>
        `;

        tr.appendChild(tdClass);
        tr.appendChild(tdId);
        tr.appendChild(tdQty);
        tr.appendChild(tdName);
        tr.appendChild(tdGroup);
        tr.appendChild(tdActions);

        tbody.appendChild(tr);
    });
};

/**
 * Render the editable view-group table from the current schema state.
 * @returns {void}
 */
const renderGroupsTable = () => {
    const tbody = el('groups_tbody');
    tbody.innerHTML = '';

    const groups = getViewGroups().slice();
    const usage = getGroupUsageCounts();

    groups.forEach((groupName, idx) => {
        const tr = document.createElement('tr');

        const tdName = document.createElement('td');
        tdName.innerHTML = `<input value="${escapeHtml(groupName)}" onchange="onGroupNameChange(${idx}, this.value)" />`;

        const tdCount = document.createElement('td');
        tdCount.textContent = String(usage[groupName] || 0);

        const tdActions = document.createElement('td');
        tdActions.className = 'actions';
        const inUse = (usage[groupName] || 0) > 0;
        tdActions.innerHTML = `
            <div class="inline">
                <button class="btn danger" onclick="deleteGroup(${idx})" ${inUse ? 'disabled title="Group in use"' : ''}>Delete</button>
            </div>
        `;

        tr.appendChild(tdName);
        tr.appendChild(tdCount);
        tr.appendChild(tdActions);
        tbody.appendChild(tr);
    });
};

/**
 * Update an asset field in the local editable schema.
 * @param {number} rowIndex - Asset row index.
 * @param {number} fieldIndex - Asset field index.
 * @param {string} value - New field value.
 * @returns {void}
 */
window.onAssetChange = (rowIndex, fieldIndex, value) => {
    clearError();
    clearSuccess();
    if (!assetsSchema) return;

    // clone for safer updates
    const next = JSON.parse(JSON.stringify(assetsSchema));
    next.assets[rowIndex][fieldIndex] = value;
    assetsSchema = next;
    renderTable();
    renderGroupsTable();
};

/**
 * Update an asset quantity field after numeric normalization.
 * @param {number} rowIndex - Asset row index.
 * @param {unknown} rawValue - Raw input value.
 * @returns {void}
 */
window.onAssetQuantityChange = (rowIndex, rawValue) => {
    clearError();
    clearSuccess();
    if (!assetsSchema) return;

    const n = normalizeNumber(rawValue);
    if (Number.isNaN(n)) {
        showError('Quantity must be a number');
        return;
    }

    const next = JSON.parse(JSON.stringify(assetsSchema));
    next.assets[rowIndex][2] = n;
    assetsSchema = next;
    renderTable();
    renderGroupsTable();
};

/**
 * Remove an asset row from the local editable schema.
 * @param {number} rowIndex - Asset row index.
 * @returns {void}
 */
window.deleteRow = (rowIndex) => {
    clearError();
    clearSuccess();
    if (!assetsSchema) return;

    const next = JSON.parse(JSON.stringify(assetsSchema));
    next.assets.splice(rowIndex, 1);
    assetsSchema = next;
    renderTable();
    renderGroupsTable();
};

/**
 * Move an asset row up or down in the editable ordering.
 * @param {number} rowIndex - Current asset row index.
 * @param {number} delta - Relative move amount.
 * @returns {void}
 */
window.moveRow = (rowIndex, delta) => {
    clearError();
    clearSuccess();
    if (!assetsSchema) return;

    const nextIndex = rowIndex + delta;
    if (nextIndex < 0 || nextIndex >= assetsSchema.assets.length) return;

    const next = JSON.parse(JSON.stringify(assetsSchema));
    const tmp = next.assets[rowIndex];
    next.assets[rowIndex] = next.assets[nextIndex];
    next.assets[nextIndex] = tmp;
    assetsSchema = next;
    renderTable();
    renderGroupsTable();
};

/**
 * Append a new placeholder asset row to the editable schema.
 * @returns {void}
 */
window.addNewRow = () => {
    clearError();
    clearSuccess();
    if (!assetsSchema) return;

    const next = JSON.parse(JSON.stringify(assetsSchema));
    const groups = getViewGroups();
    const defaultGroup = groups.includes('Liquidity') ? 'Liquidity' : (groups[0] || 'Liquidity');
    next.assets.push(['Liquidity', `new-asset-${Date.now()}`, 0, 'New Asset', defaultGroup]);
    assetsSchema = next;
    renderTable();
    renderGroupsTable();
};

/**
 * Fetch the latest assets schema from the backend.
 * @returns {Promise<object>}
 */
const fetchSchema = async () => {
    const res = await authFetch(`${API_BASE}/assets/schema`);
    if (!res.ok) throw new Error(`Failed to load schema (${res.status})`);
    return await res.json();
};

/**
 * Persist the full assets payload to the backend.
 * @param {{ assets: unknown[] }} payload - Asset payload to save.
 * @returns {Promise<object>}
 */
const putSchema = async (payload) => {
    const res = await authFetch(`${API_BASE}/assets/schema`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
        const msg = (json && json.error) ? json.error : `Failed to save schema (${res.status})`;
        throw new Error(msg);
    }
    return json;
};

/**
 * Persist the view-group list to the backend.
 * @param {{ viewGroups: string[] }} payload - View groups to save.
 * @returns {Promise<object>}
 */
const putViewGroups = async (payload) => {
    const res = await authFetch(`${API_BASE}/assets/view-groups`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
    });
    const json = await res.json().catch(() => null);
    if (!res.ok) {
        const msg = (json && json.error) ? json.error : `Failed to save view groups (${res.status})`;
        throw new Error(msg);
    }
    return json;
};

/**
 * Populate the password export controls from the stored password.
 * @returns {void}
 */
const initExportPassword = () => {
    const input = el('export_password');
    const copyBtn = el('export_password_btn');
    const toggleBtn = el('toggle_password_btn');
    if (!input || !copyBtn || !toggleBtn) return;

    const password = getPassword();
    if (!password) {
        input.value = '';
        input.placeholder = 'No password found';
        copyBtn.disabled = true;
        toggleBtn.disabled = true;
        return;
    }

    input.value = password;
    copyBtn.disabled = false;
    toggleBtn.disabled = false;
};

/**
 * Copy the stored password to the clipboard from the settings page.
 * @returns {Promise<void>}
 */
window.copyPassword = async () => {
    clearError();
    clearSuccess();

    const password = getPassword();
    if (!password) {
        showError('No password found');
        return;
    }

    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(password);
        } else {
            const input = el('export_password');
            if (input) {
                input.type = 'text';
                input.select();
                document.execCommand('copy');
                input.type = 'password';
            } else {
                throw new Error('Clipboard not available');
            }
        }
        showSuccess('Password copied to clipboard');
    } catch (e) {
        showError('Failed to copy password');
    }
};

/**
 * Toggle the visibility of the exported password input.
 * @returns {void}
 */
window.togglePasswordVisibility = () => {
    const input = el('export_password');
    const toggleBtn = el('toggle_password_btn');
    if (!input || !toggleBtn) return;

    const isHidden = input.type === 'password';
    input.type = isHidden ? 'text' : 'password';
    toggleBtn.textContent = isHidden ? '🙈' : '👁️';
};

/**
 * Load the latest schema from the backend and re-render the page.
 * @returns {Promise<void>}
 */
window.loadSchema = async () => {
    clearError();
    clearSuccess();
    setButtonsDisabled(true);

    try {
        assetsSchema = await fetchSchema();
        renderTable();
        renderGroupsTable();
    } catch (e) {
        showError(e.message || String(e));
    } finally {
        setButtonsDisabled(false);
    }
};

/**
 * Validate and save the current asset rows.
 * @returns {Promise<void>}
 */
window.saveAll = async () => {
    clearError();
    clearSuccess();
    if (!assetsSchema) return;

    const assets = assetsSchema.assets;
    const validationError = validateAssets(assets);
    if (validationError) {
        showError(validationError);
        return;
    }

    setButtonsDisabled(true);
    try {
        const result = await putSchema({ assets });
        assetsSchema = result.assetsSchema;
        renderTable();
        renderGroupsTable();
        showSuccess('Saved');
    } catch (e) {
        showError(e.message || String(e));
    } finally {
        setButtonsDisabled(false);
    }
};

/**
 * Update a view-group name in the local editable schema.
 * @param {number} groupIndex - View-group index.
 * @param {string} value - New group name.
 * @returns {void}
 */
window.onGroupNameChange = (groupIndex, value) => {
    clearError();
    clearSuccess();
    if (!assetsSchema) return;

    const name = String(value ?? '').trim();
    if (!name) {
        showError('Group name is required');
        return;
    }

    const next = JSON.parse(JSON.stringify(assetsSchema));
    next.viewGroups = Array.isArray(next.viewGroups) ? next.viewGroups : DEFAULT_VIEW_GROUPS.slice();
    next.viewGroups[groupIndex] = name;
    // Keep ordering stable; only trim and drop empties here.
    next.viewGroups = next.viewGroups.map(g => String(g).trim()).filter(Boolean);
    assetsSchema = next;
    renderTable();
    renderGroupsTable();
};

/**
 * Append a new placeholder view group to the editable schema.
 * @returns {void}
 */
window.addGroup = () => {
    clearError();
    clearSuccess();
    if (!assetsSchema) return;

    const next = JSON.parse(JSON.stringify(assetsSchema));
    const groups = Array.isArray(next.viewGroups) ? next.viewGroups.slice() : DEFAULT_VIEW_GROUPS.slice();
    const base = 'NewGroup';
    let candidate = base;
    let i = 1;
    while (groups.includes(candidate)) {
        candidate = `${base}${i++}`;
    }
    groups.push(candidate);
    next.viewGroups = groups;
    assetsSchema = next;
    renderTable();
    renderGroupsTable();
};

/**
 * Remove an unused view group from the local editable schema.
 * @param {number} groupIndex - View-group index.
 * @returns {void}
 */
window.deleteGroup = (groupIndex) => {
    clearError();
    clearSuccess();
    if (!assetsSchema) return;

    const groups = getViewGroups();
    const groupName = groups[groupIndex];
    const usage = getGroupUsageCounts();
    if ((usage[groupName] || 0) > 0) {
        showError(`Can't delete '${groupName}' because it's used by ${usage[groupName]} asset(s)`);
        return;
    }

    const next = JSON.parse(JSON.stringify(assetsSchema));
    next.viewGroups = groups.slice();
    next.viewGroups.splice(groupIndex, 1);
    assetsSchema = next;
    renderTable();
    renderGroupsTable();
};

/**
 * Validate and save the current view-group list.
 * @returns {Promise<void>}
 */
window.saveGroups = async () => {
    clearError();
    clearSuccess();
    if (!assetsSchema) return;

    const groups = getViewGroups().map(g => String(g).trim()).filter(Boolean);
    if (!groups.length) {
        showError('You must have at least 1 view group');
        return;
    }

    // Block duplicates client-side to avoid ambiguous migrations.
    const dupCheck = new Set();
    const dups = [];
    for (const g of groups) {
        if (dupCheck.has(g)) dups.push(g);
        dupCheck.add(g);
    }
    if (dups.length) {
        showError(`Duplicate group name(s): ${uniq(dups).join(', ')}`);
        return;
    }

    setButtonsDisabled(true);
    try {
        const result = await putViewGroups({ viewGroups: groups });
        assetsSchema = result.assetsSchema;
        renderTable();
        renderGroupsTable();
        showSuccess('Groups saved');
    } catch (e) {
        showError(e.message || String(e));
    } finally {
        setButtonsDisabled(false);
    }
};

// initial load
window.addEventListener('load', () => {
    loadSchema();
    initExportPassword();
});
