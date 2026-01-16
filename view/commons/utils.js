// Common utilities shared across all pages

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
    const res = await fetch(`${API_BASE}/assets/schema`);
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
