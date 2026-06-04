# Zero-Knowledge Authentication and Client-State Migration Plan

This document details the step-by-step implementation plan for **Phase 1** (client-side identity) and **Phase 2** (integrated client-state and client-mediated migration) of the Zero-Knowledge Refactor, taking the project from its current dual-stack state to a true zero-knowledge authentication and storage lifecycle.

## Overview

In the current state, the backend has parallel routes for opaque `userBlob` persistence and stateless market analytics, but the UI still relies on the legacy password flow. Moving forward, the browser will own the core secret, derive all keys, run all portfolio arithmetic, and maintain user state as encrypted ciphertext.

The migration must be handled **client-side** since the server cannot read or transform decrypted user schema or history.

---

## Step 1: Standardize Client State Structure

Instead of maintaining separate legacy files, the client state will be consolidated into a single unified JSON document.

### Unified Secure State Schema
The ciphertext payload in `/user/blob` decrupts into an object of the following format:
```json
{
  "schema": {
    "assets": [],
    "viewGroups": [],
    "riskOverrides": {}
  },
  "history": {
    "months": {}
  }
}
```

- **schema.assets & schema.viewGroups**: Copied from legacy `assetsSchema.json`.
- **schema.riskOverrides**: Stores local risk scores for `Other` assets.
- **history.months**: Copied from legacy `historicalData.json`.

---

## Step 2: Refactor Login and Account Registration (`view/login`)

Replace the legacy password-validation check of `/auth/validate` with a local key-derivation check and a client-side registration model.

### New Registration Flow (Local Secret Generation)
1. When a user clicks **Generate New Password**:
   - Call `generateRandomSecret()` in [view/commons/utils.js](view/commons/utils.js) entirely locally in the browser (eliminating dependencies on rate-limited `/auth/generate`).
   - Derive the `userId` via `await deriveUserId(secret)`.
   - Initialize a default blank client state schema:
     ```json
     {
       "schema": { "assets": [], "viewGroups": [], "riskOverrides": {} },
       "history": { "months": {} }
     }
     ```
   - Encrypt this default state using `await encryptUserBlob(secret, defaultState)`.
   - Upload the resulting ciphertext envelope to `/user/blob` via `putUserBlobEnvelope(userId, envelope)`.
   - Save the credentials in localStorage:
     - `localStorage.setItem('opaqueUserSecret', secret)`
     - `localStorage.setItem('opaqueUserId', userId)`
   - Display the generated secret to the user for copying/secure backup.
   - Redirect to `/dashboard/`.

### New Login Flow (with Client-Mediated Legacy Migration)
1. User enters their secret on the login screen.
2. Derivation:
   - Derive `userId = await deriveUserId(secret)`.
3. Try fetching the zero-knowledge envelope:
   - Request the envelope from `/user/blob` using that `userId`.
   - **If the envelope exists**:
     - Attempt decryption inside the browser using `await decryptUserBlob(secret, envelope)`.
     - **If decryption succeeds**: Authentication is successful. Set `opaqueUserSecret` and `opaqueUserId` in `localStorage`, then redirect to `/dashboard/`.
     - **If decryption fails**: Show "Invalid password / secret."
   - **If the envelope does NOT exist (404)**:
     - The user may be a legacy user logging in for the first time, or it is a non-existent account.
     - Try backward-compatible legacy verification:
       - Send the secret (acting as the old password) to the legacy `/auth/validate` endpoint.
       - **If validation fails**: Show "Invalid password / secret."
       - **If validation succeeds (Legacy Account Found)**:
         - Enter **Client-Mediated Migration Mode**:
         - Fetch legacy plaintext files from the server:
           - Fetch legacy assets schema: `/assets/schema` (using legacy authentication header `X-User-Password`).
           - Fetch legacy monthly history: `/portfolio/history` (using legacy authentication header `X-User-Password`).
         - Map the separate plaintext files into the new **Unified Secure State Schema** defined in Step 1.
         - Encrypt the new consolidated schema using `await encryptUserBlob(secret, unifiedState)`.
         - Upload the encrypted state to `/user/blob` using `await putUserBlobEnvelope(userId, envelope)`.
         - Set zero-knowledge session credentials:
           - `localStorage.setItem('opaqueUserSecret', secret)`
           - `localStorage.setItem('opaqueUserId', userId)`
         - **Irreversible Deletion**: Call `/auth/user` with `DELETE` (using the legacy password headers) to wipe the server's plain files and hash folders entirely, deleting old plain state.
         - Redirect to `/dashboard/`.

---

## Step 3: Implement In-Memory Unified State Management

To avoid decrypting the secure envelope on every single page interaction or component render, implement a simple in-memory cache pattern in the browser.

- Shared state will be managed in [view/commons/utils.js](view/commons/utils.js).
- Introduce standard runtime helpers:
  ```javascript
  let cachedPlaintextState = null;

  const loadPlaintextState = async () => {
      if (cachedPlaintextState) return cachedPlaintextState;
      const secret = getUserSecret();
      const userId = getUserId();
      if (!secret || !userId) throw new Error("No active session");

      const envelope = await fetchUserBlobEnvelope(userId);
      if (!envelope) throw new Error("A account exists but has no data envelope");

      cachedPlaintextState = await decryptUserBlob(secret, envelope);
      return cachedPlaintextState;
  };

  const savePlaintextState = async (state) => {
      const secret = getUserSecret();
      const userId = getUserId();
      if (!secret || !userId) throw new Error("No active session");

      const envelope = await encryptUserBlob(secret, state);
      await putUserBlobEnvelope(userId, envelope);
      cachedPlaintextState = state;
  };
  ```

---

## Step 4: Verification and Testing Guide

To ensure zero-knowledge mechanics are fully functional and secure:

1. **Unit and Route Level Tests**:
   - Adapt `tests/server/user-blob.test.js` to verify invalid user ID formatting and envelope schema mismatches.
   - Run stateless scrape validation against `/market/quotes` and `/market/risk-indicators`.

2. **Integration Verification via Network Analysis**:
   - Monitor devtools network tab.
   - Verify that the legacy passwords and endpoints `/auth/validate`, `/auth/generate`, `/portfolio`, `/assets/schema`, etc. are no longer requested after migration.
   - Ensure that the server data folder `data/users/<userId>/` contains only `userBlob.json` and no plain JSON files.

## References and Related Log Entries
- Zero-knowledge foundation architecture: [docs/data-model.md](docs/data-model.md)
- Stateless route layout: [docs/frontend-cache.md](docs/frontend-cache.md)
- Recent changes log: [docs/log.md](docs/log.md)
