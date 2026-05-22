/**
 * Manage editable asset rows, view groups, display preferences, and account export or deletion controls on the settings page.
 */

// Require authentication
if (!requireAuth()) {
    throw new Error('Not authenticated');
}

let assetsSchema = null;
let deleteUserModalLastActiveElement = null;
let isDeleteUserInProgress = false;

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
 * Check whether the delete-user confirmation modal is currently visible.
 * @returns {boolean}
 */
const isDeleteUserModalOpen = () => {
    const overlay = el('delete_user_modal_overlay');
    return Boolean(overlay && !overlay.hidden);
};

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
        tr.setAttribute('data-testid', `asset-row-${String(assetId).replaceAll(/[^a-zA-Z0-9_-]+/g, '-')}`);

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
        tr.setAttribute('data-testid', `view-group-row-${String(groupName).replaceAll(/[^a-zA-Z0-9_-]+/g, '-')}`);

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
    next.assets.push(['Other', `new-asset-${Date.now()}`, 0, 'New Asset', defaultGroup]);
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
 * Fetch the persisted historical portfolio data from the backend.
 * @returns {Promise<object[]>}
 */
const fetchHistoricalData = async () => {
    const res = await authFetch(`${API_BASE}/portfolio/history`);
    if (!res.ok) throw new Error(`Failed to load history (${res.status})`);
    return await res.json();
};

/**
 * Trigger a browser download for the provided JSON payload.
 * @param {string} fileName - Downloaded file name.
 * @param {unknown} payload - Serializable export payload.
 * @returns {void}
 */
const downloadJsonFile = (fileName, payload) => {
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const downloadUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = downloadUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => {
        window.URL.revokeObjectURL(downloadUrl);
    }, 0);
};

/**
 * Show or clear the inline message rendered inside the delete-user modal.
 * @param {'success'|'error'|''} tone - Visual tone for the message.
 * @param {string} message - Text to display.
 * @returns {void}
 */
const setDeleteUserModalMessage = (tone, message) => {
    const banner = el('delete_user_modal_message');
    if (!banner) return;

    if (!message) {
        banner.hidden = true;
        banner.textContent = '';
        banner.className = 'delete_user_modal_message';
        return;
    }

    banner.hidden = false;
    banner.textContent = message;
    banner.className = `delete_user_modal_message ${tone}`;
};

/**
 * Route modal-originated success and error states to the visible confirmation dialog.
 * @param {'success'|'error'} tone - Message tone.
 * @param {string} message - Text to display.
 * @returns {void}
 */
const showDeleteUserFeedback = (tone, message) => {
    if (isDeleteUserModalOpen()) {
        setDeleteUserModalMessage(tone, message);
        return;
    }

    if (tone === 'success') {
        showSuccess(message);
        return;
    }

    showError(message);
};

/**
 * Show or hide the delete-user confirmation modal.
 * @param {boolean} open - Whether the modal should be visible.
 * @returns {void}
 */
const setDeleteUserModalOpen = (open) => {
    const overlay = el('delete_user_modal_overlay');
    const modal = el('delete_user_modal');
    if (!overlay || !modal) return;

    if (open) {
        deleteUserModalLastActiveElement = document.activeElement && typeof document.activeElement.focus === 'function'
            ? document.activeElement
            : null;
        overlay.hidden = false;
        overlay.setAttribute('aria-hidden', 'false');
        document.body.classList.add('modal_open');
        modal.focus();
        return;
    }

    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('modal_open');
    setDeleteUserModalMessage('', '');

    if (deleteUserModalLastActiveElement && typeof deleteUserModalLastActiveElement.focus === 'function') {
        deleteUserModalLastActiveElement.focus();
    }

    deleteUserModalLastActiveElement = null;
};

/**
 * Enable or disable the destructive-action controls while deletion is running.
 * @param {boolean} disabled - Whether modal controls should be disabled.
 * @returns {void}
 */
const setDeleteUserModalButtonsDisabled = (disabled) => {
    isDeleteUserInProgress = disabled;

    ['delete_user_btn', 'delete_user_close_btn', 'delete_user_modal_export_btn', 'delete_user_cancel_btn', 'delete_user_confirm_btn'].forEach((id) => {
        const button = el(id);
        if (button) button.disabled = disabled;
    });
};

/**
 * Delete the current user's persisted backend record.
 * @returns {Promise<void>}
 */
const deleteCurrentUserRecord = async () => {
    const res = await authFetch(`${API_BASE}/auth/user`, { method: 'DELETE' });
    const json = await res.json().catch(() => null);

    if (!res.ok) {
        throw new Error((json && json.error) ? json.error : `Failed to remove user data (${res.status})`);
    }
};

/**
 * Close the delete-user modal when Escape is pressed.
 * @param {KeyboardEvent} event - Browser keyboard event.
 * @returns {void}
 */
const handleDeleteUserModalKeydown = (event) => {
    if (event.key !== 'Escape' || !isDeleteUserModalOpen() || isDeleteUserInProgress) {
        return;
    }

    event.preventDefault();
    window.closeDeleteUserModal();
};

/**
 * Initialize modal event wiring for the delete-user confirmation flow.
 * @returns {void}
 */
const initDeleteUserModal = () => {
    const overlay = el('delete_user_modal_overlay');
    if (!overlay) return;

    overlay.hidden = true;
    overlay.setAttribute('aria-hidden', 'true');
    setDeleteUserModalButtonsDisabled(false);
    setDeleteUserModalMessage('', '');
    window.addEventListener('keydown', handleDeleteUserModalKeydown);
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
 * Sync the hide-absolute checkbox with the stored display preference.
 * @returns {void}
 */
const syncAbsoluteVisibilityPreference = () => {
    const checkbox = el('hide_absolute_toggle');
    if (!checkbox || typeof window.isAbsoluteHidden !== 'function') return;

    checkbox.checked = window.isAbsoluteHidden();
};

/**
 * Initialize the hide-absolute display preference control.
 * @returns {void}
 */
const initAbsoluteVisibilityPreference = () => {
    const checkbox = el('hide_absolute_toggle');
    if (!checkbox || typeof window.setAbsoluteHidden !== 'function') return;

    syncAbsoluteVisibilityPreference();
    checkbox.addEventListener('change', () => {
        window.setAbsoluteHidden(checkbox.checked);
    });
};

/**
 * Sync the compact-values checkbox with the stored display preference.
 * @returns {void}
 */
const syncCompactValuesPreference = () => {
    const checkbox = el('compact_values_toggle');
    if (!checkbox || typeof window.isCompactValuesEnabled !== 'function') return;

    checkbox.checked = window.isCompactValuesEnabled();
};

/**
 * Initialize the compact-values display preference control.
 * @returns {void}
 */
const initCompactValuesPreference = () => {
    const checkbox = el('compact_values_toggle');
    if (!checkbox || typeof window.setCompactValuesEnabled !== 'function') return;

    syncCompactValuesPreference();
    checkbox.addEventListener('change', () => {
        window.setCompactValuesEnabled(checkbox.checked);
    });
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
 * Download the persisted user schema and history data as a single JSON export.
 * @returns {Promise<void>}
 */
window.exportUserData = async () => {
    clearError();
    clearSuccess();
    setDeleteUserModalMessage('', '');

    const exportBtn = el('delete_user_modal_export_btn');
    if (exportBtn) exportBtn.disabled = true;

    try {
        const [schema, historicalData] = await Promise.all([
            fetchSchema(),
            fetchHistoricalData(),
        ]);
        const { schemaCacheKey, ...persistedAssetsSchema } = schema || {};

        downloadJsonFile('personal-finance-data-export.json', {
            assetsSchema: persistedAssetsSchema,
            historicalData,
        });
        showDeleteUserFeedback('success', 'User data exported');
    } catch (e) {
        showDeleteUserFeedback('error', e.message || 'Failed to export user data');
    } finally {
        if (exportBtn && !isDeleteUserInProgress) exportBtn.disabled = false;
    }
};

/**
 * Open the delete-user confirmation modal.
 * @returns {void}
 */
window.openDeleteUserModal = () => {
    clearError();
    clearSuccess();
    setDeleteUserModalMessage('', '');
    setDeleteUserModalOpen(true);
};

/**
 * Close the delete-user confirmation modal.
 * @returns {void}
 */
window.closeDeleteUserModal = () => {
    if (isDeleteUserInProgress) return;
    setDeleteUserModalOpen(false);
};

/**
 * Close the delete-user confirmation modal when the overlay itself is clicked.
 * @param {MouseEvent} event - Click event from the modal overlay.
 * @returns {void}
 */
window.handleDeleteUserModalBackdropClick = (event) => {
    if (event.target === el('delete_user_modal_overlay')) {
        window.closeDeleteUserModal();
    }
};

/**
 * Permanently remove the current user's server-side data and clear local auth state.
 * @returns {Promise<void>}
 */
window.confirmDeleteUser = async () => {
    clearError();
    clearSuccess();
    setDeleteUserModalMessage('', '');

    if (isDeleteUserInProgress) return;

    setDeleteUserModalButtonsDisabled(true);
    try {
        await deleteCurrentUserRecord();
        logout();
    } catch (e) {
        showDeleteUserFeedback('error', e.message || 'Failed to remove user data');
    } finally {
        setDeleteUserModalButtonsDisabled(false);
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
    initAbsoluteVisibilityPreference();
    initCompactValuesPreference();
    initExportPassword();
    initDeleteUserModal();
});
