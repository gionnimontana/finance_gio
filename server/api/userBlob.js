/**
 * Persist and validate opaque per-user ciphertext blobs keyed by a client-derived user id.
 */
const fs = require('fs')
const path = require('path')

const { USERS_DIR } = require('../auth')

const USER_BLOB_FILE_NAME = 'userBlob.json'
const USER_ID_PATTERN = /^[a-f0-9]{64}$/i
const MAX_USER_BLOB_BYTES = Number(process.env.PFB_MAX_USER_BLOB_BYTES || (1024 * 1024))

/**
 * Check whether a value is a plain object.
 * @param {unknown} value - Candidate value.
 * @returns {boolean}
 */
const isPlainObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value)

/**
 * Normalize a client-derived user id into the canonical lowercase form.
 * @param {unknown} userId - Candidate user id.
 * @returns {string}
 */
const normalizeUserId = (userId) => String(userId || '').trim().toLowerCase()

/**
 * Check whether a client-derived user id matches the supported SHA-256 hex format.
 * @param {unknown} userId - Candidate user id.
 * @returns {boolean}
 */
const isValidUserId = (userId) => USER_ID_PATTERN.test(normalizeUserId(userId))

/**
 * Validate a client-derived user id and return its normalized value.
 * @param {unknown} userId - Candidate user id.
 * @returns {string}
 */
const assertValidUserId = (userId) => {
    const normalizedUserId = normalizeUserId(userId)
    if (!isValidUserId(normalizedUserId)) {
        throw new Error('Invalid userId: expected 64 hexadecimal characters')
    }
    return normalizedUserId
}

/**
 * Check whether a candidate field contains non-empty base64-like text.
 * @param {unknown} value - Candidate field value.
 * @returns {boolean}
 */
const isNonEmptyString = (value) => typeof value === 'string' && value.trim() !== ''

/**
 * Validate the supported opaque user-blob envelope shape.
 * @param {unknown} envelope - Candidate ciphertext envelope.
 * @returns {boolean}
 */
const isValidUserBlobEnvelope = (envelope) => {
    if (!isPlainObject(envelope)) return false
    if (envelope.version !== 1) return false

    if (!isPlainObject(envelope.kdf)) return false
    if (envelope.kdf.name !== 'PBKDF2') return false
    if (!isNonEmptyString(envelope.kdf.hash)) return false
    if (!Number.isInteger(envelope.kdf.iterations) || envelope.kdf.iterations < 100000) return false
    if (!isNonEmptyString(envelope.kdf.salt)) return false

    if (!isPlainObject(envelope.cipher)) return false
    if (envelope.cipher.name !== 'AES-GCM') return false
    if (!isNonEmptyString(envelope.cipher.iv)) return false
    if (!isNonEmptyString(envelope.cipher.ciphertext)) return false

    return true
}

/**
 * Validate a candidate ciphertext envelope and return it when valid.
 * @param {unknown} envelope - Candidate ciphertext envelope.
 * @returns {{ version: 1, kdf: { name: 'PBKDF2', hash: string, iterations: number, salt: string }, cipher: { name: 'AES-GCM', iv: string, ciphertext: string } }}
 */
const assertValidUserBlobEnvelope = (envelope) => {
    if (!isValidUserBlobEnvelope(envelope)) {
        throw new Error('Invalid user blob envelope')
    }

    return envelope
}

/**
 * Resolve the per-user directory used for opaque blob storage.
 * @param {unknown} userId - Client-derived user id.
 * @returns {string}
 */
const getUserBlobDir = (userId) => path.join(USERS_DIR, assertValidUserId(userId))

/**
 * Resolve the opaque user-blob file path for one account.
 * @param {unknown} userId - Client-derived user id.
 * @returns {string}
 */
const getUserBlobPath = (userId) => path.join(getUserBlobDir(userId), USER_BLOB_FILE_NAME)

/**
 * Ensure the top-level users directory exists.
 * @returns {void}
 */
const ensureUsersDir = () => {
    if (!fs.existsSync(USERS_DIR)) {
        fs.mkdirSync(USERS_DIR, { recursive: true })
    }
}

/**
 * Read the stored opaque blob envelope for one user.
 * @param {unknown} userId - Client-derived user id.
 * @returns {{ version: 1, kdf: { name: 'PBKDF2', hash: string, iterations: number, salt: string }, cipher: { name: 'AES-GCM', iv: string, ciphertext: string } }|null}
 */
const getUserBlob = (userId) => {
    const blobPath = getUserBlobPath(userId)
    if (!fs.existsSync(blobPath)) {
        return null
    }

    const raw = fs.readFileSync(blobPath, 'utf8')
    const parsed = JSON.parse(raw)
    return assertValidUserBlobEnvelope(parsed)
}

/**
 * Persist one opaque blob envelope for a user.
 * @param {unknown} userId - Client-derived user id.
 * @param {unknown} envelope - Candidate ciphertext envelope.
 * @returns {{ bytes: number, path: string }}
 */
const putUserBlob = (userId, envelope) => {
    const normalizedUserId = assertValidUserId(userId)
    const validatedEnvelope = assertValidUserBlobEnvelope(envelope)
    const serializedEnvelope = `${JSON.stringify(validatedEnvelope, null, 2)}\n`
    const bytes = Buffer.byteLength(serializedEnvelope)

    if (bytes > MAX_USER_BLOB_BYTES) {
        throw new Error(`Invalid user blob envelope: payload exceeds ${MAX_USER_BLOB_BYTES} bytes`)
    }

    ensureUsersDir()

    const blobDir = getUserBlobDir(normalizedUserId)
    if (!fs.existsSync(blobDir)) {
        fs.mkdirSync(blobDir, { recursive: true })
    }

    const blobPath = getUserBlobPath(normalizedUserId)
    const tempPath = `${blobPath}.tmp`
    fs.writeFileSync(tempPath, serializedEnvelope, 'utf8')
    fs.renameSync(tempPath, blobPath)

    return { bytes, path: blobPath }
}

/**
 * Remove the stored opaque user blob and its containing directory.
 * @param {unknown} userId - Client-derived user id.
 * @returns {boolean}
 */
const deleteUserBlob = (userId) => {
    const blobDir = getUserBlobDir(userId)
    if (!fs.existsSync(blobDir)) {
        return false
    }

    fs.rmSync(blobDir, { recursive: true, force: true })
    return true
}

module.exports = {
    USER_BLOB_FILE_NAME,
    MAX_USER_BLOB_BYTES,
    normalizeUserId,
    isValidUserId,
    isValidUserBlobEnvelope,
    getUserBlobDir,
    getUserBlobPath,
    getUserBlob,
    putUserBlob,
    deleteUserBlob,
}