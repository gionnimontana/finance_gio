const fs = require('fs')
const os = require('os')
const path = require('path')
const test = require('node:test')
const assert = require('node:assert/strict')

test('deleteUser removes the persisted user directory', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pfb-auth-delete-'))
  const previousDataDir = process.env.PFB_DATA_DIR

  process.env.PFB_DATA_DIR = tempDir
  const authModulePath = require.resolve('../../server/auth')
  delete require.cache[authModulePath]
  const auth = require('../../server/auth')

  try {
    const passwordHash = auth.hashPassword('delete-me-user')
    const userDir = auth.getUserDataDir(passwordHash)

    auth.createUser(passwordHash)
    assert.equal(fs.existsSync(userDir), true)

    assert.equal(auth.deleteUser(passwordHash), true)
    assert.equal(fs.existsSync(userDir), false)
    assert.equal(auth.deleteUser(passwordHash), false)
  } finally {
    delete require.cache[authModulePath]

    if (previousDataDir === undefined) {
      delete process.env.PFB_DATA_DIR
    } else {
      process.env.PFB_DATA_DIR = previousDataDir
    }

    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})