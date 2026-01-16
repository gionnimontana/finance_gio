// Login page script
// Uses getPassword, setPassword from ../commons/utils.js

// Check if already logged in
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

// Validate password with server
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

// Generate new password
const generateNewPassword = async () => {
    try {
        const res = await fetch(`${API_BASE}/auth/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await res.json();
        return data.password || null;
    } catch (error) {
        console.error('Generation failed:', error);
        return null;
    }
};

// Show error message
const showLoginError = (message) => {
    const banner = el('error_banner');
    banner.textContent = message;
    banner.classList.add('visible');
};

// Hide error message
const hideLoginError = () => {
    const banner = el('error_banner');
    banner.textContent = '';
    banner.classList.remove('visible');
};

// Handle login button click
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

// Handle generate button click
const handleGenerate = async () => {
    hideLoginError();
    
    el('generate_btn').disabled = true;
    el('generate_btn').textContent = 'Generating...';
    
    const password = await generateNewPassword();
    
    if (password) {
        // Store the password immediately
        setPassword(password);
        
        // Show the generated password screen
        el('login_form').style.display = 'none';
        el('generated_password').classList.remove('hidden');
        el('new_password').textContent = password;
    } else {
        showLoginError('Failed to generate password. Please try again.');
        el('generate_btn').disabled = false;
        el('generate_btn').textContent = 'Generate New Password';
    }
};

// Handle copy button click
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

// Handle continue button click
const handleContinue = () => {
    window.location.href = '/dashboard/';
};

// Initialize
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
};

init();
