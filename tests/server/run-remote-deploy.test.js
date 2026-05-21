const os = require('os')
const path = require('path')
const test = require('node:test')
const assert = require('node:assert/strict')

const remoteDeploy = require('../../server/scripts/runRemoteDeploy')

test('parseCliArgs accepts an env file override', () => {
  const cliArgs = remoteDeploy.parseCliArgs(['--env-file', '.env.deploy'])

  assert.equal(cliArgs.help, false)
  assert.ok(cliArgs.envFile.endsWith('.env.deploy'))
})

test('createRemoteDeployConfigFromEnv validates SSH config and remote app path', () => {
  const envFilePath = path.join(os.tmpdir(), '.env')
  const config = remoteDeploy.createRemoteDeployConfigFromEnv({
    PFB_DEPLOY_SSH_HOST: 'finance.example.com',
    PFB_DEPLOY_SSH_USER: 'deploy',
    PFB_DEPLOY_APP_PATH: '/home/financegio',
  }, envFilePath)

  assert.equal(config.appPath, '/home/financegio')
  assert.deepEqual(config.sshConfig, {
    host: 'finance.example.com',
    user: 'deploy',
    port: '22',
    privateKeyPath: null,
    privateKey: null,
    password: null,
    strictHostKeyChecking: true,
    knownHostsPath: null,
  })
})

test('createRemoteDeployConfigFromEnv requires the remote app path env var', () => {
  const envFilePath = path.join(os.tmpdir(), '.env')

  assert.throws(() => {
    remoteDeploy.createRemoteDeployConfigFromEnv({
      PFB_DEPLOY_SSH_HOST: 'finance.example.com',
      PFB_DEPLOY_SSH_USER: 'deploy',
    }, envFilePath)
  }, /PFB_DEPLOY_APP_PATH/)
})

test('buildRemoteDeployCommand quotes the remote app path before running deploy.sh', () => {
  assert.equal(
    remoteDeploy.buildRemoteDeployCommand("/home/financegio/finance bot/it's live"),
    "cd '/home/financegio/finance bot/it'\\''s live' && bash ./deploy.sh"
  )
})