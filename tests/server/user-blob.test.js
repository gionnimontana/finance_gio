const fs = require('fs')
const os = require('os')
const path = require('path')
const test = require('node:test')
const assert = require('node:assert/strict')

const authModulePath = require.resolve('../../server/auth')
const userBlobModulePath = require.resolve('../../server/api/userBlob')

/**
 * Reload the opaque blob module after changing env-backed data roots.
 * @returns {import('../../server/api/userBlob')}
 */
const loadUserBlobModule = () => {
  delete require.cache[authModulePath]
  delete require.cache[userBlobModulePath]

  return require('../../server/api/userBlob')
}

/**
 * Run a test body with an isolated temporary data directory.
 * @param {(context: { tempDir: string, userBlob: import('../../server/api/userBlob') }) => void} worker - Test body.
 * @returns {void}
 */
const withTempDataDir = (worker) => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pfb-user-blob-'))
  const previousDataDir = process.env.PFB_DATA_DIR

  process.env.PFB_DATA_DIR = tempDir

  try {
    worker({
      tempDir,
      userBlob: loadUserBlobModule(),
    })
  } finally {
    delete require.cache[authModulePath]
    delete require.cache[userBlobModulePath]

    if (previousDataDir === undefined) {
      delete process.env.PFB_DATA_DIR
    } else {
      process.env.PFB_DATA_DIR = previousDataDir
    }

    fs.rmSync(tempDir, { recursive: true, force: true })
  }
}

const VALID_USER_ID = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

const createEnvelope = () => ({
  version: 1,
  kdf: {
    name: 'PBKDF2',
    hash: 'SHA-256',
    iterations: 250000,
    salt: 'c2FsdA==',
  },
  cipher: {
    name: 'AES-GCM',
    iv: 'aXY=',
    ciphertext: 'Y2lwaGVydGV4dA==',
  },
})

test('putUserBlob persists a validated envelope and getUserBlob reads it back', () => {
  withTempDataDir(({ userBlob }) => {
    const blobPath = userBlob.getUserBlobPath(VALID_USER_ID)

    assert.equal(userBlob.getUserBlob(VALID_USER_ID), null)

    const writeResult = userBlob.putUserBlob(VALID_USER_ID, createEnvelope())

    assert.equal(fs.existsSync(blobPath), true)
    assert.equal(writeResult.path, blobPath)
    assert.match(fs.readFileSync(blobPath, 'utf8'), /"ciphertext": "Y2lwaGVydGV4dA=="/)
    assert.deepEqual(userBlob.getUserBlob(VALID_USER_ID), createEnvelope())
  })
})

test('putUserBlob rejects invalid envelopes and deleteUserBlob removes stored blobs', () => {
  withTempDataDir(({ userBlob }) => {
    assert.throws(() => {
      userBlob.putUserBlob(VALID_USER_ID, {
        version: 1,
        kdf: {
          name: 'PBKDF2',
          hash: 'SHA-256',
          iterations: 10,
          salt: 'c2FsdA==',
        },
        cipher: {
          name: 'AES-GCM',
          iv: 'aXY=',
          ciphertext: 'Y2lwaGVydGV4dA==',
        },
      })
    }, /Invalid user blob envelope/)

    userBlob.putUserBlob(VALID_USER_ID, createEnvelope())
    assert.equal(userBlob.deleteUserBlob(VALID_USER_ID), true)
    assert.equal(userBlob.getUserBlob(VALID_USER_ID), null)
    assert.equal(userBlob.deleteUserBlob(VALID_USER_ID), false)
  })
})