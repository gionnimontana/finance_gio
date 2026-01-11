let assetsSchema = null;

const API_BASE = (() => {
    try {
        // If opened from file://, relative fetch('/...') becomes file:///..., so default to server.
        if (window.location && window.location.protocol === 'file:') {
            return 'http://localhost:8085';
        }
        return window.location.origin;
    } catch (e) {
        return 'http://localhost:8085';
    }
})();

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

const el = (id) => document.getElementById(id);

const showError = (message) => {
    const banner = el('error_banner');
    banner.textContent = message;
    banner.classList.add('visible');
};

const clearError = () => {
    const banner = el('error_banner');
    banner.textContent = '';
    banner.classList.remove('visible');
};

const showSuccess = (message) => {
    const banner = el('success_banner');
    banner.textContent = message;
    banner.classList.add('visible');
    window.setTimeout(() => {
        banner.classList.remove('visible');
    }, 2500);
};

const clearSuccess = () => {
    const banner = el('success_banner');
    banner.textContent = '';
    banner.classList.remove('visible');
};

const escapeHtml = (unsafe) => {
    return String(unsafe)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
};

const renderSelect = (options, value, onChange) => {
    const opts = options.map(o => `<option value="${escapeHtml(o)}" ${o === value ? 'selected' : ''}>${escapeHtml(o)}</option>`).join('');
    return `<select onchange="${onChange}">${opts}</select>`;
};

const normalizeNumber = (value) => {
    if (value === null || value === undefined) return NaN;
    if (typeof value === 'number') return value;
    // allow commas
    const cleaned = String(value).trim().replace(',', '.');
    return Number(cleaned);
};

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

const setButtonsDisabled = (disabled) => {
    el('reload_btn').disabled = disabled;
    el('add_btn').disabled = disabled;
    el('save_btn').disabled = disabled;
    el('groups_reload_btn').disabled = disabled;
    el('groups_add_btn').disabled = disabled;
    el('groups_save_btn').disabled = disabled;
};

const getViewGroups = () => {
    const groups = assetsSchema?.viewGroups;
    if (Array.isArray(groups) && groups.length) return groups;
    return DEFAULT_VIEW_GROUPS.slice();
};

const uniq = (arr) => Array.from(new Set(arr.map(v => String(v))));

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

const fetchSchema = async () => {
    const res = await fetch(`${API_BASE}/assets/schema`);
    if (!res.ok) throw new Error(`Failed to load schema (${res.status})`);
    return await res.json();
};

const putSchema = async (payload) => {
    const res = await fetch(`${API_BASE}/assets/schema`, {
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

const putViewGroups = async (payload) => {
    const res = await fetch(`${API_BASE}/assets/view-groups`, {
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
});
