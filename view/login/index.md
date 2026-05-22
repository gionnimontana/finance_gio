# Login

This folder contains the unauthenticated entry page used to validate an existing password or create a new account.

## Files

- [index.html](./index.html): Login page markup for password entry, password generation, feedback banners, and the shared dark loading overlay used during auth checks and redirect handoffs.
- [script.js](./script.js): Login validation, account generation, clipboard copy, redirect logic, and dismissal of the shared loading overlay once the login shell is confirmed to stay visible.
- [styles.css](./styles.css): Page-specific styling for the login and generated-password states, including the shared shell width used to keep the login card and footer aligned on this page.