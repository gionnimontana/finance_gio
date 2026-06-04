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

// Zero-knowledge session storage keys
const USER_ID_KEY = 'opaqueUserId';
const USER_SECRET_KEY = 'opaqueUserSecret';

const USER_BLOB_VERSION = 1;
const USER_BLOB_KDF_ITERATIONS = 250000;
const USER_BLOB_KDF_NAME = 'PBKDF2';
const USER_BLOB_KDF_HASH = 'SHA-256';
const USER_BLOB_CIPHER_NAME = 'AES-GCM';

const UTF8_ENCODER = new TextEncoder();
const UTF8_DECODER = new TextDecoder();

const PAGE_LOADING_HIDE_DELAY_MS = 220;

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

/**
 * Read the stored opaque user id from localStorage.
 * @returns {string|null}
 */
const getUserId = () => localStorage.getItem(USER_ID_KEY);

/**
 * Persist the active opaque user id in localStorage.
 * @param {string} userId - Client-derived user id.
 * @returns {void}
 */
const setUserId = (userId) => localStorage.setItem(USER_ID_KEY, userId);

/**
 * Remove the stored opaque user id.
 * @returns {void}
 */
const clearUserId = () => localStorage.removeItem(USER_ID_KEY);

/**
 * Read the stored zero-knowledge secret from localStorage.
 * @returns {string|null}
 */
const getUserSecret = () => localStorage.getItem(USER_SECRET_KEY);

/**
 * Persist the active zero-knowledge secret in localStorage.
 * @param {string} secret - Raw client-owned secret.
 * @returns {void}
 */
const setUserSecret = (secret) => localStorage.setItem(USER_SECRET_KEY, secret);

/**
 * Remove the stored zero-knowledge secret.
 * @returns {void}
 */
const clearUserSecret = () => localStorage.removeItem(USER_SECRET_KEY);

/**
 * Clear all stored zero-knowledge session state.
 * @returns {void}
 */
const clearZeroKnowledgeSession = () => {
    clearUserId();
    clearUserSecret();
};

/**
 * Resolve the browser Web Crypto implementation or throw when unavailable.
 * @returns {Crypto}
 */
const getWebCrypto = () => {
    const webCrypto = globalThis.crypto;
    if (!webCrypto || typeof webCrypto.getRandomValues !== 'function' || !webCrypto.subtle) {
        throw new Error('Web Crypto API unavailable');
    }
    return webCrypto;
};

/**
 * Convert a byte array into a lowercase hexadecimal string.
 * @param {Uint8Array} bytes - Source bytes.
 * @returns {string}
 */
const bytesToHex = (bytes) => Array.from(bytes).map((value) => value.toString(16).padStart(2, '0')).join('');

/**
 * Encode bytes as base64.
 * @param {Uint8Array} bytes - Source bytes.
 * @returns {string}
 */
const bytesToBase64 = (bytes) => {
    let binary = '';
    const chunkSize = 0x8000;
    for (let index = 0; index < bytes.length; index += chunkSize) {
        binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
    }
    return btoa(binary);
};

/**
 * Decode a base64 string into bytes.
 * @param {string} value - Base64 string.
 * @returns {Uint8Array}
 */
const base64ToBytes = (value) => {
    const normalizedValue = String(value || '').replace(/-/g, '+').replace(/_/g, '/');
    const paddedValue = normalizedValue.padEnd(Math.ceil(normalizedValue.length / 4) * 4, '=');
    const binary = atob(paddedValue);
    return Uint8Array.from(binary, (char) => char.charCodeAt(0));
};

/**
 * Create cryptographically random bytes.
 * @param {number} length - Number of bytes to generate.
 * @returns {Uint8Array}
 */
const createRandomBytes = (length) => {
    const bytes = new Uint8Array(length);
    getWebCrypto().getRandomValues(bytes);
    return bytes;
};

/**
 * Generate a high-entropy secret suitable for the zero-knowledge account flow.
 * @param {number} [byteLength=24] - Number of random bytes before base64url encoding.
 * @returns {string}
 */
const generateRandomSecret = (byteLength = 24) => bytesToBase64(createRandomBytes(byteLength))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

/**
 * Derive the opaque user id from the raw client-owned secret.
 * @param {string} secret - Raw client-owned secret.
 * @returns {Promise<string>}
 */
const deriveUserId = async (secret) => {
    const digest = await getWebCrypto().subtle.digest('SHA-256', UTF8_ENCODER.encode(String(secret || '')));
    return bytesToHex(new Uint8Array(digest));
};

/**
 * Import a raw secret for PBKDF2-based key derivation.
 * @param {string} secret - Raw client-owned secret.
 * @returns {Promise<CryptoKey>}
 */
const importSecretKeyMaterial = (secret) => getWebCrypto().subtle.importKey(
    'raw',
    UTF8_ENCODER.encode(String(secret || '')),
    USER_BLOB_KDF_NAME,
    false,
    ['deriveKey']
);

/**
 * Validate the supported opaque blob-envelope shape.
 * @param {unknown} envelope - Candidate ciphertext envelope.
 * @returns {boolean}
 */
const isValidUserBlobEnvelope = (envelope) => {
    if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope)) return false;
    if (envelope.version !== USER_BLOB_VERSION) return false;
    if (!envelope.kdf || typeof envelope.kdf !== 'object' || Array.isArray(envelope.kdf)) return false;
    if (envelope.kdf.name !== USER_BLOB_KDF_NAME) return false;
    if (envelope.kdf.hash !== USER_BLOB_KDF_HASH) return false;
    if (!Number.isInteger(envelope.kdf.iterations) || envelope.kdf.iterations < 100000) return false;
    if (typeof envelope.kdf.salt !== 'string' || !envelope.kdf.salt.trim()) return false;
    if (!envelope.cipher || typeof envelope.cipher !== 'object' || Array.isArray(envelope.cipher)) return false;
    if (envelope.cipher.name !== USER_BLOB_CIPHER_NAME) return false;
    if (typeof envelope.cipher.iv !== 'string' || !envelope.cipher.iv.trim()) return false;
    if (typeof envelope.cipher.ciphertext !== 'string' || !envelope.cipher.ciphertext.trim()) return false;
    return true;
};

/**
 * Derive the AES-GCM key used to encrypt one opaque user blob.
 * @param {string} secret - Raw client-owned secret.
 * @param {string} salt - Base64-encoded random salt.
 * @returns {Promise<CryptoKey>}
 */
const deriveUserBlobKey = async (secret, salt) => getWebCrypto().subtle.deriveKey({
    name: USER_BLOB_KDF_NAME,
    hash: USER_BLOB_KDF_HASH,
    salt: base64ToBytes(salt),
    iterations: USER_BLOB_KDF_ITERATIONS,
}, await importSecretKeyMaterial(secret), {
    name: USER_BLOB_CIPHER_NAME,
    length: 256,
}, false, ['encrypt', 'decrypt']);

/**
 * Encrypt a client-owned state document into the opaque user-blob envelope used by the backend.
 * @param {string} secret - Raw client-owned secret.
 * @param {unknown} payload - Serializable state document.
 * @param {{ reuseSaltFrom?: { kdf?: { salt?: string } } }} [options={}] - Encryption overrides.
 * @returns {Promise<{ version: 1, kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: number, salt: string }, cipher: { name: 'AES-GCM', iv: string, ciphertext: string } }>}
 */
const encryptUserBlob = async (secret, payload, options = {}) => {
    if (!secret) {
        throw new Error('A secret is required to encrypt user state');
    }

    const salt = options.reuseSaltFrom?.kdf?.salt || bytesToBase64(createRandomBytes(16));
    const iv = bytesToBase64(createRandomBytes(12));
    const key = await deriveUserBlobKey(secret, salt);
    const plaintextBytes = UTF8_ENCODER.encode(JSON.stringify(payload));
    const ciphertextBuffer = await getWebCrypto().subtle.encrypt({
        name: USER_BLOB_CIPHER_NAME,
        iv: base64ToBytes(iv),
    }, key, plaintextBytes);

    return {
        version: USER_BLOB_VERSION,
        kdf: {
            name: USER_BLOB_KDF_NAME,
            hash: USER_BLOB_KDF_HASH,
            iterations: USER_BLOB_KDF_ITERATIONS,
            salt,
        },
        cipher: {
            name: USER_BLOB_CIPHER_NAME,
            iv,
            ciphertext: bytesToBase64(new Uint8Array(ciphertextBuffer)),
        },
    };
};

/**
 * Decrypt an opaque user-blob envelope into a parsed state document.
 * @param {string} secret - Raw client-owned secret.
 * @param {unknown} envelope - Ciphertext envelope returned by the backend.
 * @returns {Promise<unknown>}
 */
const decryptUserBlob = async (secret, envelope) => {
    if (!secret) {
        throw new Error('A secret is required to decrypt user state');
    }

    if (!isValidUserBlobEnvelope(envelope)) {
        throw new Error('Invalid user blob envelope');
    }

    const key = await deriveUserBlobKey(secret, envelope.kdf.salt);
    const plaintextBuffer = await getWebCrypto().subtle.decrypt({
        name: USER_BLOB_CIPHER_NAME,
        iv: base64ToBytes(envelope.cipher.iv),
    }, key, base64ToBytes(envelope.cipher.ciphertext));

    return JSON.parse(UTF8_DECODER.decode(new Uint8Array(plaintextBuffer)));
};

/**
 * Perform a user-id-authenticated fetch against the opaque blob routes.
 * @param {string} userId - Client-derived user id.
 * @param {RequestInit & { url: string }} options - Fetch options plus the target URL.
 * @returns {Promise<Response>}
 */
const userIdFetch = async (userId, options) => {
    if (!userId) {
        throw new Error('A user id is required');
    }

    return fetch(options.url, {
        ...options,
        headers: {
            ...options.headers,
            'X-User-Id': userId,
        },
    });
};

/**
 * Read an error message from a JSON response when available.
 * @param {Response} response - Failed response.
 * @returns {Promise<string>}
 */
const readResponseErrorMessage = async (response) => {
    try {
        const payload = await response.json();
        if (payload && typeof payload.error === 'string' && payload.error.trim()) {
            return payload.error.trim();
        }
    } catch (error) {
        // Ignore JSON parse failures and fall back to the status line.
    }

    return `${response.status} ${response.statusText}`.trim();
};

/**
 * Fetch the stored opaque blob envelope for one user id.
 * @param {string} userId - Client-derived user id.
 * @returns {Promise<object|null>}
 */
const fetchUserBlobEnvelope = async (userId) => {
    const response = await userIdFetch(userId, {
        url: `${API_BASE}/user/blob`,
        method: 'GET',
    });

    if (response.status === 404) {
        return null;
    }

    if (!response.ok) {
        throw new Error(`Failed to load user blob (${await readResponseErrorMessage(response)})`);
    }

    return await response.json();
};

/**
 * Persist an opaque user-blob envelope for one user id.
 * @param {string} userId - Client-derived user id.
 * @param {object} envelope - Valid ciphertext envelope.
 * @returns {Promise<object>}
 */
const putUserBlobEnvelope = async (userId, envelope) => {
    const response = await userIdFetch(userId, {
        url: `${API_BASE}/user/blob`,
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(envelope),
    });

    if (!response.ok) {
        throw new Error(`Failed to persist user blob (${await readResponseErrorMessage(response)})`);
    }

    return await response.json();
};

/**
 * Delete the stored opaque user blob for one user id.
 * @param {string} userId - Client-derived user id.
 * @returns {Promise<boolean>}
 */
const deleteUserBlobEnvelope = async (userId) => {
    const response = await userIdFetch(userId, {
        url: `${API_BASE}/user/blob`,
        method: 'DELETE',
    });

    if (response.status === 404) {
        return false;
    }

    if (!response.ok) {
        throw new Error(`Failed to delete user blob (${await readResponseErrorMessage(response)})`);
    }

    return true;
};

/**
 * Perform a JSON POST request against a stateless market-data endpoint.
 * @param {string} url - Target URL.
 * @param {object} payload - JSON payload.
 * @returns {Promise<object>}
 */
const postJson = async (url, payload) => {
    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        throw new Error(`Request failed (${await readResponseErrorMessage(response)})`);
    }

    return await response.json();
};

/**
 * Fetch stateless quote values for explicit dynamic asset descriptors.
 * @param {Array<{ assetClass: string, assetId: string }>} assets - Dynamic asset descriptors.
 * @param {boolean} [refresh=false] - Whether to bypass fresh server-side scrape cache entries.
 * @returns {Promise<{ values: Record<string, number>, failures: string[] }>}
 */
const fetchStatelessQuotes = async (assets, refresh = false) => postJson(`${API_BASE}/market/quotes`, {
    assets,
    refresh,
});

/**
 * Fetch stateless risk indicators for explicit asset descriptors.
 * @param {Array<{ assetClass: string, assetId: string }>} assets - Asset descriptors.
 * @param {boolean} [refresh=false] - Whether to bypass fresh server-side scrape cache entries.
 * @param {Record<string, number>} [riskOverrides={}] - Other-asset overrides to apply locally-owned metadata.
 * @returns {Promise<{ values: Record<string, { value: number, label: string }>, failures: string[] }>}
 */
const fetchStatelessRiskIndicators = async (assets, refresh = false, riskOverrides = {}) => postJson(`${API_BASE}/market/risk-indicators`, {
    assets,
    refresh,
    riskOverrides,
});

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
    clearZeroKnowledgeSession();
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
window.getUserId = getUserId;
window.setUserId = setUserId;
window.clearUserId = clearUserId;
window.getUserSecret = getUserSecret;
window.setUserSecret = setUserSecret;
window.clearUserSecret = clearUserSecret;
window.clearZeroKnowledgeSession = clearZeroKnowledgeSession;
window.generateRandomSecret = generateRandomSecret;
window.deriveUserId = deriveUserId;
window.isValidUserBlobEnvelope = isValidUserBlobEnvelope;
window.encryptUserBlob = encryptUserBlob;
window.decryptUserBlob = decryptUserBlob;
window.fetchUserBlobEnvelope = fetchUserBlobEnvelope;
window.putUserBlobEnvelope = putUserBlobEnvelope;
window.deleteUserBlobEnvelope = deleteUserBlobEnvelope;
window.fetchStatelessQuotes = fetchStatelessQuotes;
window.fetchStatelessRiskIndicators = fetchStatelessRiskIndicators;
window.getAthMood = getAthMood;
window.renderPercentageValue = renderPercentageValue;
