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

// Absolute values visibility key
const ABS_VISIBILITY_KEY = 'hideAbsoluteValues';

// Compact values formatting key
const COMPACT_VALUES_KEY = 'useCompactAbsoluteValues';

// Only EUR is supported today, so shared formatters default to this symbol.
const CURRENCY_SYMBOL = '€';

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
 * Sync the privacy-toggle button with the current visibility state.
 * @param {boolean} hidden - Whether absolute values are hidden.
 * @returns {void}
 */
const updateAbsoluteToggleButton = (hidden) => {
    const btn = el('abs_toggle_btn');
    if (!btn) return;
    btn.innerHTML = hidden ? '🙈' : '👁️';
    btn.title = hidden ? 'Show absolute values' : 'Hide absolute values';
    btn.setAttribute('aria-pressed', hidden ? 'true' : 'false');
};

/**
 * Apply the absolute-value visibility state to the page and notify listeners.
 * @param {boolean} [hidden=isAbsoluteHidden()] - Whether absolute values should be hidden.
 * @returns {void}
 */
const applyAbsoluteVisibility = (hidden = isAbsoluteHidden()) => {
    document.body.classList.toggle('hide_absolute', hidden);
    updateAbsoluteToggleButton(hidden);
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

/**
 * Toggle the absolute-value visibility state.
 * @returns {void}
 */
const toggleAbsoluteVisibility = () => setAbsoluteHidden(!isAbsoluteHidden());

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
        const btn = el('abs_toggle_btn');
        if (btn) btn.addEventListener('click', toggleAbsoluteVisibility);
    });
} else {
    applyAbsoluteVisibility();
    const btn = el('abs_toggle_btn');
    if (btn) btn.addEventListener('click', toggleAbsoluteVisibility);
}

window.isAbsoluteHidden = isAbsoluteHidden;
window.isCompactValuesEnabled = isCompactValuesEnabled;
window.applyAbsoluteVisibility = applyAbsoluteVisibility;
window.setCompactValuesEnabled = setCompactValuesEnabled;
window.toggleAbsoluteVisibility = toggleAbsoluteVisibility;
window.renderPercentageValue = renderPercentageValue;
