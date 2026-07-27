/**
 * Handle login validation, account generation, and password handoff on the login page.
 */

/**
 * Validate any stored password and detect whether the user is already authenticated.
 * @returns {Promise<boolean>}
 */
const checkExistingAuth = async () => {
    const password = getPassword();
    if (!password) return false;
    
    try {
        const res = await fetch(`${API_BASE}/auth/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        const data = await res.json();
        return data.valid === true;
    } catch (error) {
        console.error('Auth check failed:', error);
        return false;
    }
};

/**
 * Validate a password against the backend.
 * @param {string} password - Password to validate.
 * @returns {Promise<boolean>}
 */
const validatePassword = async (password) => {
    try {
        const res = await fetch(`${API_BASE}/auth/validate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ password })
        });
        const data = await res.json();
        return data.valid === true;
    } catch (error) {
        console.error('Validation failed:', error);
        return false;
    }
};

/**
 * Request a new account password from the backend.
 * @returns {Promise<{ password: string|null, error: string|null, code: string|null, retryAfterSeconds: number }>}
 */
const generateNewPassword = async () => {
    try {
        const res = await fetch(`${API_BASE}/auth/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });

        const data = await res.json();

        if (!res.ok) {
            return {
                password: null,
                error: data?.error || 'Failed to generate password',
                code: data?.code || null,
                retryAfterSeconds: data?.retryAfterSeconds || 0
            };
        }

        return {
            password: data.password || null,
            error: null,
            code: null,
            retryAfterSeconds: 0
        };
    } catch (error) {
        console.error('Generation failed:', error);
        return {
            password: null,
            error: 'Failed to generate password. Please try again.',
            code: null,
            retryAfterSeconds: 0
        };
    }
};

/**
 * Build a user-facing rate-limit message from the backend retry hint.
 * @param {number} retryAfterSeconds - Retry delay in seconds.
 * @returns {string}
 */
const formatRetryAfterMessage = (retryAfterSeconds) => {
    if (!retryAfterSeconds) {
        return 'Account creation is temporarily unavailable. Please try again later.';
    }

    const retryAfterMinutes = Math.ceil(retryAfterSeconds / 60);
    const minuteLabel = retryAfterMinutes === 1 ? 'minute' : 'minutes';

    return `Account creation is temporarily unavailable. Please try again in about ${retryAfterMinutes} ${minuteLabel}.`;
};

/**
 * Show a login-page error banner.
 * @param {string} message - Message to display.
 * @returns {void}
 */
const showLoginError = (message) => {
    const banner = el('error_banner');
    banner.textContent = message;
    banner.classList.add('visible');
};

/**
 * Clear the login-page error banner.
 * @returns {void}
 */
const hideLoginError = () => {
    const banner = el('error_banner');
    banner.textContent = '';
    banner.classList.remove('visible');
};

/**
 * Submit the login form and redirect on success.
 * @returns {Promise<void>}
 */
const handleLogin = async () => {
    hideLoginError();
    const password = el('password_input').value.trim();
    
    if (!password) {
        showLoginError('Please enter a password');
        return;
    }
    
    el('login_btn').disabled = true;
    el('login_btn').textContent = 'Checking...';
    
    const valid = await validatePassword(password);
    
    if (valid) {
        setPassword(password);
        window.location.href = '/dashboard/';
    } else {
        showLoginError('Invalid password. Check your password or generate a new one.');
        el('login_btn').disabled = false;
        el('login_btn').textContent = 'Login';
    }
};

/**
 * Generate a new account password and reveal the confirmation state.
 * @returns {Promise<void>}
 */
const handleGenerate = async () => {
    hideLoginError();
    
    el('generate_btn').disabled = true;
    el('generate_btn').textContent = 'Generating...';
    
    const result = await generateNewPassword();
    
    if (result.password) {
        // Store the password immediately
        setPassword(result.password);
        
        // Show the generated password screen
        el('login_form').style.display = 'none';
        el('generated_password').classList.remove('hidden');
        el('new_password').textContent = result.password;
    } else {
        if (result.code === 'ACCOUNT_GENERATION_RATE_LIMITED') {
            showLoginError(formatRetryAfterMessage(result.retryAfterSeconds));
        } else {
            showLoginError(result.error || 'Failed to generate password. Please try again.');
        }

        el('generate_btn').disabled = false;
        el('generate_btn').textContent = 'Generate New Password';
    }
};

/**
 * Copy the generated password to the clipboard.
 * @returns {Promise<void>}
 */
const handleCopy = async () => {
    const password = el('new_password').textContent;
    try {
        await navigator.clipboard.writeText(password);
        el('copy_btn').textContent = 'Copied!';
        setTimeout(() => {
            el('copy_btn').textContent = 'Copy';
        }, 2000);
    } catch (error) {
        console.error('Copy failed:', error);
    }
};

/**
 * Continue to the dashboard after the generated password has been acknowledged.
 * @returns {void}
 */
const handleContinue = () => {
    window.location.href = '/dashboard/';
};

/**
 * Initialize login page event handlers and auto-login redirect behavior.
 * @returns {Promise<void>}
 */
const init = async () => {
    // Check if already authenticated
    const isAuth = await checkExistingAuth();
    if (isAuth) {
        window.location.href = '/dashboard/';
        return;
    }
    
    // Setup event listeners
    el('login_btn').addEventListener('click', handleLogin);
    el('generate_btn').addEventListener('click', handleGenerate);
    el('copy_btn').addEventListener('click', handleCopy);
    el('continue_btn').addEventListener('click', handleContinue);
    
    // Allow Enter key to submit
    el('password_input').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            handleLogin();
        }
    });

    hidePageLoading();
};

init();
