// Common utilities shared across all pages

// Base path for the app (for nginx deployment at /financegio)
const BASE_PATH = '/financegio';

const API_BASE = (() => {
    try {
        // If opened from file://, relative fetch('/...') becomes file:///..., so default to server.
        if (window.location && window.location.protocol === 'file:') {
            return 'http://localhost:8085';
        }
        // In production, use the proxied API path
        return window.location.origin + BASE_PATH + '/api';
    } catch (e) {
        return 'http://localhost:8085';
    }
})();

// Password storage key
const PASSWORD_KEY = 'userPassword';

// Get stored password
const getPassword = () => localStorage.getItem(PASSWORD_KEY);

// Store password
const setPassword = (password) => localStorage.setItem(PASSWORD_KEY, password);

// Clear password (logout)
const clearPassword = () => localStorage.removeItem(PASSWORD_KEY);

// Logout and redirect to login
const logout = () => {
    clearPassword();
    localStorage.removeItem('portfolio'); // Clear cached portfolio data
    window.location.href = BASE_PATH + '/login/';
};

// Check if authenticated and redirect to login if not
const requireAuth = () => {
    const password = getPassword();
    if (!password) {
        window.location.href = BASE_PATH + '/login/';
        return false;
    }
    return true;
};

// Authenticated fetch wrapper - adds X-User-Password header
const authFetch = async (url, options = {}) => {
    const password = getPassword();
    if (!password) {
        window.location.href = BASE_PATH + '/login/';
        throw new Error('Not authenticated';
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
const t = (number) => number.toFixed(2);

// Calculate percentage
const pct = (value, total) => ((value / total) * 100).toFixed(1);

// Get element by ID shorthand
const el = (id) => document.getElementById(id);

// Escape HTML to prevent XSS
const escapeHtml = (unsafe) => {
    return String(unsafe)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
};

// Fetch assets schema from API
const fetchAssetsSchema = async () => {
    const res = await authFetch(`${API_BASE}/assets/schema`);
    if (!res.ok) throw new Error(`Failed to load assets schema (${res.status})`);
    return await res.json();
};

// Show error banner
const showError = (message, bannerId = 'error_banner') => {
    const banner = el(bannerId);
    if (banner) {
        banner.textContent = message;
        banner.classList.add('visible');
    }
};

// Clear error banner
const clearError = (bannerId = 'error_banner') => {
    const banner = el(bannerId);
    if (banner) {
        banner.textContent = '';
        banner.classList.remove('visible');
    }
};

// Show success banner with auto-hide
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
const clearSuccess = (bannerId = 'success_banner') => {
    const banner = el(bannerId);
    if (banner) {
        banner.textContent = '';
        banner.classList.remove('visible');
    }
};
