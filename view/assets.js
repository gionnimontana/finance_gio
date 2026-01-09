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

const VIEW_GROUPS = [
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
};

const renderTable = () => {
    const tbody = el('assets_tbody');
    tbody.innerHTML = '';

    const assets = (assetsSchema?.assets || []).slice();

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
        tdGroup.innerHTML = renderSelect(VIEW_GROUPS, viewGroup, `onAssetChange(${idx}, 4, this.value)`);

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

window.onAssetChange = (rowIndex, fieldIndex, value) => {
    clearError();
    clearSuccess();
    if (!assetsSchema) return;

    // clone for safer updates
    const next = JSON.parse(JSON.stringify(assetsSchema));
    next.assets[rowIndex][fieldIndex] = value;
    assetsSchema = next;
    renderTable();
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
};

window.deleteRow = (rowIndex) => {
    clearError();
    clearSuccess();
    if (!assetsSchema) return;

    const next = JSON.parse(JSON.stringify(assetsSchema));
    next.assets.splice(rowIndex, 1);
    assetsSchema = next;
    renderTable();
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
};

window.addNewRow = () => {
    clearError();
    clearSuccess();
    if (!assetsSchema) return;

    const next = JSON.parse(JSON.stringify(assetsSchema));
    next.assets.push(['Liquidity', `new-asset-${Date.now()}`, 0, 'New Asset', 'Liquidity']);
    assetsSchema = next;
    renderTable();
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

window.loadSchema = async () => {
    clearError();
    clearSuccess();
    setButtonsDisabled(true);

    try {
        assetsSchema = await fetchSchema();
        renderTable();
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
        showSuccess('Saved');
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
