/**
 * Provide shared frontend auth, formatting, banner, footer, and display-preference utilities.
 */

// Shared footer copy
const FOOTER_COPY = 'This site does not track any user activity, and all sections are completely anonymous.';

// Base path for the app (root deployment)
const BASE_PATH = '';

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

// Password storage key
const PASSWORD_KEY = 'userPassword';

const PAGE_LOADING_HIDE_DELAY_MS = 220;

// Absolute values visibility key
const ABS_VISIBILITY_KEY = 'hideAbsoluteValues';

// Compact values formatting key
const COMPACT_VALUES_KEY = 'useCompactAbsoluteValues';

// Only EUR is supported today, so shared formatters default to this symbol.
const CURRENCY_SYMBOL = '€';

const DEFAULT_VIEW_GROUP_COLORS = Object.freeze({
    Equity: '#4CAF50',
    Crypto: '#FF9800',
    Liquidity: '#2196F3',
    Gold: '#FFD700',
    Houses: '#9C27B0'
});

const FALLBACK_VIEW_GROUP_COLORS = Object.freeze([
    '#00897B',
    '#5E35B1',
    '#E53935',
    '#6D4C41',
    '#546E7A',
    '#C2185B'
]);

/**
 * Resolve a deterministic default hex color for a view-group label.
 * @param {string} label - View-group label.
 * @returns {string}
 */
const getDefaultViewGroupColor = (label) => {
    const groupName = String(label || '');
    if (DEFAULT_VIEW_GROUP_COLORS[groupName]) {
        return DEFAULT_VIEW_GROUP_COLORS[groupName];
    }

    let hash = 0;
    for (let index = 0; index < groupName.length; index++) {
        hash = ((hash << 5) - hash) + groupName.charCodeAt(index);
        hash |= 0;
    }
    return FALLBACK_VIEW_GROUP_COLORS[Math.abs(hash) % FALLBACK_VIEW_GROUP_COLORS.length];
};

/**
 * Resolve a saved color when valid, otherwise use the stable default for its view group.
 * @param {string} label - View-group label.
 * @param {Record<string, string>|null|undefined} viewGroupColors - Saved group-color map.
 * @returns {string}
 */
const resolveViewGroupColor = (label, viewGroupColors) => {
    const groupName = String(label || '');
    const savedColor = viewGroupColors && typeof viewGroupColors === 'object' && !Array.isArray(viewGroupColors)
        ? viewGroupColors[groupName]
        : null;

    if (typeof savedColor === 'string' && /^#[0-9a-fA-F]{6}$/.test(savedColor)) {
        return savedColor.toUpperCase();
    }

    return getDefaultViewGroupColor(groupName);
};

/**
 * Read the stored user password from localStorage.
 * @returns {string|null}
 */
const getPassword = () => localStorage.getItem(PASSWORD_KEY);

/**
 * Persist the active user password in localStorage.
 * @param {string} password - Password to store.
 * @returns {void}
 */
const setPassword = (password) => localStorage.setItem(PASSWORD_KEY, password);

/**
 * Remove the stored user password during logout or auth expiry.
 * @returns {void}
 */
const clearPassword = () => localStorage.removeItem(PASSWORD_KEY);

/**
 * Resolve the shared full-screen loading overlay when the current page uses it.
 * @returns {HTMLElement|null}
 */
const getPageLoadingOverlay = () => document.getElementById('page_loading');

/**
 * Fade out the shared full-screen loading overlay after the current UI has painted.
 * @returns {void}
 */
const hidePageLoading = () => {
    const overlay = getPageLoadingOverlay();
    if (!overlay || overlay.hidden || overlay.dataset.state === 'closing') return;

    const closeOverlay = () => {
        const activeOverlay = getPageLoadingOverlay();
        if (!activeOverlay || activeOverlay.hidden || activeOverlay.dataset.state === 'closing') return;

        activeOverlay.dataset.state = 'closing';
        activeOverlay.classList.add('is_hidden');

        window.setTimeout(() => {
            const latestOverlay = getPageLoadingOverlay();
            if (!latestOverlay || latestOverlay.dataset.state !== 'closing') return;

            latestOverlay.hidden = true;
            latestOverlay.classList.remove('is_hidden');
            delete latestOverlay.dataset.state;
        }, PAGE_LOADING_HIDE_DELAY_MS);
    };

    if (typeof window.requestAnimationFrame === 'function') {
        window.requestAnimationFrame(() => {
            window.requestAnimationFrame(closeOverlay);
        });
        return;
    }

    closeOverlay();
};

// Absolute values visibility helpers
/**
 * Check whether absolute portfolio values are hidden.
 * @returns {boolean}
 */
const isAbsoluteHidden = () => localStorage.getItem(ABS_VISIBILITY_KEY) === '1';

/**
 * Check whether compact absolute-value formatting is enabled.
 * @returns {boolean}
 */
const isCompactValuesEnabled = () => localStorage.getItem(COMPACT_VALUES_KEY) === '1';

/**
 * Persist the compact absolute-value formatting preference.
 * @param {boolean} enabled - Whether compact formatting should be used.
 * @returns {void}
 */
const setCompactValuesEnabled = (enabled) => localStorage.setItem(COMPACT_VALUES_KEY, enabled ? '1' : '0');

/**
 * Apply the absolute-value visibility state to the page and notify listeners.
 * @param {boolean} [hidden=isAbsoluteHidden()] - Whether absolute values should be hidden.
 * @returns {void}
 */
const applyAbsoluteVisibility = (hidden = isAbsoluteHidden()) => {
    document.body.classList.toggle('hide_absolute', hidden);
    window.dispatchEvent(new CustomEvent('absolute-visibility-change', { detail: { hidden } }));
};

/**
 * Persist and apply the absolute-value visibility state.
 * @param {boolean} hidden - Whether absolute values should be hidden.
 * @returns {void}
 */
const setAbsoluteHidden = (hidden) => {
    localStorage.setItem(ABS_VISIBILITY_KEY, hidden ? '1' : '0');
    applyAbsoluteVisibility(hidden);
};

// Logout and redirect to login
/**
 * Clear cached auth state and redirect the user to the login page.
 * @returns {void}
 */
const logout = () => {
    clearPassword();
    localStorage.removeItem('portfolio'); // Clear cached portfolio data
    window.location.href = BASE_PATH + '/login/';
};

// Check if authenticated and redirect to login if not
/**
 * Ensure the current page has an authenticated user before continuing.
 * @returns {boolean}
 */
const requireAuth = () => {
    const password = getPassword();
    if (!password) {
        window.location.href = BASE_PATH + '/login/';
        return false;
    }
    return true;
};

// Authenticated fetch wrapper - adds X-User-Password header
/**
 * Perform a fetch request with the stored password attached as an auth header.
 * @param {string} url - Request URL.
 * @param {RequestInit} [options={}] - Fetch options.
 * @returns {Promise<Response>}
 */
const authFetch = async (url, options = {}) => {
    const password = getPassword();
    if (!password) {
        window.location.href = BASE_PATH + '/login/';
        throw new Error('Not authenticated');
    }
    
    const response = await fetch(url, {
        ...options,
        headers: {
            ...options.headers,
            'X-User-Password': password
        }
    });
    
    // If 401, redirect to login
    if (response.status === 401) {
        clearPassword();
        window.location.href = BASE_PATH + '/login/';
        throw new Error('Authentication expired');
    }
    
    return response;
};

// Format number to 2 decimal places
/**
 * Format a number with two fixed decimal places.
 * @param {number} number - Value to format.
 * @returns {string}
 */
const t = (number) => number.toFixed(2);

/**
 * Resolve the ATH face and accessible label from the drawdown percentage.
 * @param {number} distancePercentage - Percentage distance from all-time high.
 * @returns {{ icon: string, label: string }}
 */
const getAthMood = (distancePercentage) => {
    if (distancePercentage >= 0) {
        return { icon: '🤩', label: 'Portfolio at all time high' };
    }

    if (distancePercentage <= -50) {
        return { icon: '😭', label: 'Portfolio is at least 50 percent below all time high' };
    }

    if (distancePercentage <= -35) {
        return { icon: '😢', label: 'Portfolio is between 35 and 50 percent below all time high' };
    }

    if (distancePercentage <= -20) {
        return { icon: '😟', label: 'Portfolio is between 20 and 35 percent below all time high' };
    }

    if (distancePercentage <= -10) {
        return { icon: '😬', label: 'Portfolio is between 10 and 20 percent below all time high' };
    }

    if (distancePercentage <= -2) {
        return { icon: '🙂', label: 'Portfolio is between 2 and 10 percent below all time high' };
    }

    return { icon: '😎', label: 'Portfolio is within 2 percent of all time high' };
};

/**
 * Prefix a formatted absolute-value label with the supported currency symbol unless disabled.
 * @param {string} formattedValue - Preformatted numeric label.
 * @param {{ includeCurrency?: boolean }} [options={}] - Formatting overrides.
 * @returns {string}
 */
const withCurrencySymbol = (formattedValue, options = {}) => {
    const { includeCurrency = true } = options;
    const label = String(formattedValue);

    if (!includeCurrency) {
        return label;
    }

    if (label.startsWith('+')) {
        return `+${CURRENCY_SYMBOL}${label.slice(1)}`;
    }

    if (label.startsWith('-')) {
        return `-${CURRENCY_SYMBOL}${label.slice(1)}`;
    }

    return `${CURRENCY_SYMBOL}${label}`;
};

/**
 * Format a number with separators and no decimals when compact suffixes are disabled.
 * @param {number} value - Numeric total to format.
 * @param {{ includeCurrency?: boolean }} [options={}] - Formatting overrides.
 * @returns {string}
 */
const formatExpandedValue = (value, options = {}) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return withCurrencySymbol('0', options);

    const formattedValue = new Intl.NumberFormat('en-US', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    }).format(numericValue);

    return withCurrencySymbol(formattedValue, options);
};

/**
 * Format a number using full values by default, with optional compact suffixes.
 * @param {number} value - Numeric total to format.
 * @param {number} [fractionDigits=1] - Decimal precision for compact labels.
 * @param {{ forceCompact?: boolean, includeCurrency?: boolean }} [options={}] - Formatting overrides.
 * @returns {string}
 */
const formatCompactValue = (value, fractionDigits = 1, options = {}) => {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue)) return withCurrencySymbol('0', options);

    const { forceCompact = false, includeCurrency = true } = options;

    if (!forceCompact && !isCompactValuesEnabled()) {
        return formatExpandedValue(numericValue, { includeCurrency });
    }

    const trimTrailingZeros = (formattedValue) => formattedValue.replace(/\.0+$|(\.\d*[1-9])0+$/, '$1');
    const absValue = Math.abs(numericValue);
    let compactValue = '';

    if (absValue < 1000) {
        compactValue = numericValue.toFixed(0);
        return withCurrencySymbol(compactValue, { includeCurrency });
    }

    if (absValue >= 1000000) {
        const millions = numericValue / 1000000;
        const digits = Math.abs(millions) >= 10 ? 0 : fractionDigits;
        compactValue = `${trimTrailingZeros(millions.toFixed(digits))}m`;
        return withCurrencySymbol(compactValue, { includeCurrency });
    }

    const thousands = numericValue / 1000;
    const digits = Math.abs(thousands) >= 100 ? 0 : fractionDigits;
    const roundedThousands = Number(thousands.toFixed(digits));

    if (Math.abs(roundedThousands) >= 1000) {
        const millions = numericValue / 1000000;
        compactValue = `${trimTrailingZeros(millions.toFixed(fractionDigits))}m`;
        return withCurrencySymbol(compactValue, { includeCurrency });
    }

    compactValue = `${trimTrailingZeros(thousands.toFixed(digits))}k`;
    return withCurrencySymbol(compactValue, { includeCurrency });
};

// Calculate percentage
/**
 * Calculate a percentage string for a value within a total.
 * @param {number} value - Partial value.
 * @param {number} total - Total value.
 * @returns {string}
 */
const pct = (value, total) => ((value / total) * 100).toFixed(1);

/**
 * Format a percentage label according to the current privacy mode.
 * @param {string|number|null|undefined} value - Preformatted percentage label.
 * @returns {string}
 */
const formatPercentageValue = (value) => {
    const label = value === null || value === undefined ? '—' : String(value);
    return isAbsoluteHidden() ? label : ` (${label})`;
};

/**
 * Render a percentage span that omits parentheses while privacy mode is enabled.
 * @param {string|number|null|undefined} value - Preformatted percentage label.
 * @param {string} [className='pct_value'] - CSS classes to apply to the span.
 * @returns {string}
 */
const renderPercentageValue = (value, className = 'pct_value') => `<span class="${className}">${formatPercentageValue(value)}</span>`;

// Get element by ID shorthand
/**
 * Resolve a DOM element by id.
 * @param {string} id - Element id.
 * @returns {HTMLElement|null}
 */
const el = (id) => document.getElementById(id);

// Escape HTML to prevent XSS
/**
 * Escape user-provided text before inserting it into HTML strings.
 * @param {unknown} unsafe - Raw value to escape.
 * @returns {string}
 */
const escapeHtml = (unsafe) => {
    return String(unsafe)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
};

// Fetch assets schema from API
/**
 * Fetch the current assets schema for the authenticated user.
 * @returns {Promise<object>}
 */
const fetchAssetsSchema = async () => {
    const res = await authFetch(`${API_BASE}/assets/schema`);
    if (!res.ok) throw new Error(`Failed to load assets schema (${res.status})`);
    return await res.json();
};

/**
 * Fetch the persisted historical portfolio data for the authenticated user.
 * @returns {Promise<object[]>}
 */
const fetchHistoricalData = async () => {
    const res = await authFetch(`${API_BASE}/portfolio/history`);
    if (!res.ok) throw new Error(`Failed to load history (${res.status})`);
    return await res.json();
};

/**
 * Fetch the authenticated user's asset risk indicators.
 * @param {boolean} [refresh=false] - Whether to bypass fresh backend cache entries.
 * @returns {Promise<{ values?: Record<string, { value?: number, label?: string }>, failures?: string[] }>}
 */
const fetchAssetRiskIndicators = async (refresh = false) => {
    const res = await authFetch(`${API_BASE}/assets/risk-indicators?refresh=${refresh ? 'true' : 'false'}`);
    if (!res.ok) throw new Error(`Failed to load asset risk indicators (${res.status})`);
    return await res.json();
};

// Show error banner
/**
 * Show an error banner with the provided message.
 * @param {string} message - Message to display.
 * @param {string} [bannerId='error_banner'] - Banner element id.
 * @returns {void}
 */
const showError = (message, bannerId = 'error_banner') => {
    const banner = el(bannerId);
    if (banner) {
        banner.textContent = message;
        banner.classList.add('visible');
    }
};

// Clear error banner
/**
 * Clear and hide an error banner.
 * @param {string} [bannerId='error_banner'] - Banner element id.
 * @returns {void}
 */
const clearError = (bannerId = 'error_banner') => {
    const banner = el(bannerId);
    if (banner) {
        banner.textContent = '';
        banner.classList.remove('visible');
    }
};

// Show success banner with auto-hide
/**
 * Show a success banner and hide it automatically after a timeout.
 * @param {string} message - Message to display.
 * @param {string} [bannerId='success_banner'] - Banner element id.
 * @param {number} [timeout=2500] - Auto-hide timeout in milliseconds.
 * @returns {void}
 */
const showSuccess = (message, bannerId = 'success_banner', timeout = 2500) => {
    const banner = el(bannerId);
    if (banner) {
        banner.textContent = message;
        banner.classList.add('visible');
        window.setTimeout(() => {
            banner.classList.remove('visible');
        }, timeout);
    }
};

// Clear success banner
/**
 * Clear and hide a success banner.
 * @param {string} [bannerId='success_banner'] - Banner element id.
 * @returns {void}
 */
const clearSuccess = (bannerId = 'success_banner') => {
    const banner = el(bannerId);
    if (banner) {
        banner.textContent = '';
        banner.classList.remove('visible');
    }
};

/**
 * Inject the shared privacy notice text into all footer placeholders.
 * @returns {void}
 */
const renderSiteFooter = () => {
    const footers = document.querySelectorAll('.site_footer');
    footers.forEach((footer) => {
        footer.textContent = FOOTER_COPY;
    });
};

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', renderSiteFooter);
} else {
    renderSiteFooter();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        applyAbsoluteVisibility();
    });
} else {
    applyAbsoluteVisibility();
}

window.isAbsoluteHidden = isAbsoluteHidden;
window.isCompactValuesEnabled = isCompactValuesEnabled;
window.applyAbsoluteVisibility = applyAbsoluteVisibility;
window.setAbsoluteHidden = setAbsoluteHidden;
window.setCompactValuesEnabled = setCompactValuesEnabled;
window.getAthMood = getAthMood;
window.renderPercentageValue = renderPercentageValue;
