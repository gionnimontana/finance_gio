# Assets

This folder contains the authenticated settings page used to manage assets, view groups, display preferences, and password export plus destructive account-removal flow.

## Files

- [index.html](./index.html): Settings page markup for editable asset tables, view-group management, the hide-absolute and compact absolute-values preference toggles, plus password export, the shared loading overlay used during initial schema fetches, and a destructive server-record removal modal that offers data download before deletion.
- [script.js](./script.js): Client-side asset editing, validation, persistence, display-preference wiring, password export, inline data download, current-user server-record deletion behavior, and delayed loading-overlay dismissal until the initial schema fetch finishes.
- [styles.css](./styles.css): Page-specific layout and control styling for the settings view, including the display-preferences toggle row and the delete-confirmation modal.