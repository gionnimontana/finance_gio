const fs = require('fs')
const os = require('os')
const path = require('path')
const test = require('node:test')
const assert = require('node:assert/strict')

const deploySsh = require('../../server/scripts/connectDeployServer')

test('parseCliArgs keeps helper flags separate from raw ssh flags', () => {
  const cliArgs = deploySsh.parseCliArgs([
    '--command',
    'pwd && ls -la',
    '--env-file',
    '.env',
    '--',
    '-L',
    '8085:127.0.0.1:8085',
  ])

  assert.equal(cliArgs.help, false)
  assert.equal(cliArgs.command, 'pwd && ls -la')
  assert.ok(cliArgs.envFile.endsWith('.env'))
  assert.deepEqual(cliArgs.sshArgs, ['-L', '8085:127.0.0.1:8085'])
})

test('createDeployConfigFromEnv resolves relative file paths and booleans', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pfb-deploy-config-'))
  const keyPath = path.join(tempDir, 'id_deploy')
  const knownHostsPath = path.join(tempDir, 'known_hosts')

  fs.writeFileSync(keyPath, 'key')
  fs.writeFileSync(knownHostsPath, 'host')

  try {
    const config = deploySsh.createDeployConfigFromEnv({
      PFB_DEPLOY_SSH_HOST: 'finance.example.com',
      PFB_DEPLOY_SSH_USER: 'deploy',
      PFB_DEPLOY_SSH_PORT: '2202',
      PFB_DEPLOY_SSH_PRIVATE_KEY_PATH: './id_deploy',
      PFB_DEPLOY_SSH_KNOWN_HOSTS_PATH: './known_hosts',
      PFB_DEPLOY_SSH_STRICT_HOST_KEY_CHECKING: 'false',
    }, tempDir, path.join(tempDir, '.env'))

    assert.deepEqual(config, {
      host: 'finance.example.com',
      user: 'deploy',
      port: '2202',
      privateKeyPath: keyPath,
      privateKey: null,
      password: null,
      strictHostKeyChecking: false,
      knownHostsPath,
    })
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})

test('createDeployConfigFromEnv reads an optional password for askpass auth', () => {
  const config = deploySsh.createDeployConfigFromEnv({
    PFB_DEPLOY_SSH_HOST: 'finance.example.com',
    PFB_DEPLOY_SSH_USER: 'deploy',
    PFB_DEPLOY_SSH_PASSWORD: 'super-secret-password',
  }, os.tmpdir(), path.join(os.tmpdir(), '.env'))

  assert.equal(config.password, 'super-secret-password')
})

test('normalizePrivateKey expands escaped newlines', () => {
  assert.equal(
    deploySsh.normalizePrivateKey('-----BEGIN OPENSSH PRIVATE KEY-----\\nabc\\n-----END OPENSSH PRIVATE KEY-----'),
    '-----BEGIN OPENSSH PRIVATE KEY-----\nabc\n-----END OPENSSH PRIVATE KEY-----\n'
  )
})

test('prepareSshCommand wires SSH_ASKPASS when a password is configured', () => {
  const preparedCommand = deploySsh.prepareSshCommand({
    host: 'finance.example.com',
    user: 'deploy',
    port: '22',
    privateKeyPath: null,
    privateKey: null,
    password: 'super-secret-password',
    strictHostKeyChecking: true,
    knownHostsPath: null,
  }, {
    command: 'hostname',
    sshArgs: [],
  })

  try {
    assert.ok(preparedCommand.env.SSH_ASKPASS)
    assert.equal(preparedCommand.env.SSH_ASKPASS_REQUIRE, 'force')
    assert.equal(preparedCommand.env.DISPLAY, 'pfb-deploy-ssh')
    assert.equal(fs.readFileSync(preparedCommand.env.SSH_ASKPASS, 'utf8'), '#!/bin/sh\ncat "$(dirname "$0")/password"\n')
    assert.equal(
      fs.readFileSync(path.join(path.dirname(preparedCommand.env.SSH_ASKPASS), 'password'), 'utf8'),
      'super-secret-password\n'
    )
    assert.deepEqual(preparedCommand.sshArgs, [
      '-p',
      '22',
      'deploy@finance.example.com',
      'hostname',
    ])
  } finally {
    const askpassDir = path.dirname(preparedCommand.env.SSH_ASKPASS)
    preparedCommand.cleanup()
    assert.equal(fs.existsSync(askpassDir), false)
  }
})

test('buildSshArgs appends the destination and remote command after ssh flags', () => {
  const sshArgs = deploySsh.buildSshArgs({
    host: 'finance.example.com',
    user: 'deploy',
    port: '2202',
    privateKeyPath: '/tmp/id_deploy',
    privateKey: null,
    password: null,
    strictHostKeyChecking: false,
    knownHostsPath: '/tmp/known_hosts',
  }, {
    command: 'pwd',
    sshArgs: ['-L', '8085:127.0.0.1:8085'],
  })

  assert.deepEqual(sshArgs, [
    '-p',
    '2202',
    '-i',
    '/tmp/id_deploy',
    '-o',
    'IdentitiesOnly=yes',
    '-o',
    'UserKnownHostsFile=/tmp/known_hosts',
    '-o',
    'StrictHostKeyChecking=no',
    '-L',
    '8085:127.0.0.1:8085',
    'deploy@finance.example.com',
    'pwd',
  ])
})
