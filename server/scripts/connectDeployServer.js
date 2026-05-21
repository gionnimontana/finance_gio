// SSH helper for reaching the deployed server with local-only credentials.
const fs = require('fs')
const os = require('os')
const path = require('path')
const dotenv = require('dotenv')
const { spawnSync } = require('child_process')

const ROOT_DIR = path.resolve(__dirname, '..', '..')
const DEFAULT_ENV_FILE = path.join(ROOT_DIR, '.env')
const EXAMPLE_ENV_FILE = path.join(ROOT_DIR, '.env.example')

/**
 * @typedef {object} DeploySshConfig
 * @property {string} host - Remote SSH host name.
 * @property {string} user - Remote SSH username.
 * @property {string} port - Remote SSH port.
 * @property {string | null} privateKeyPath - Absolute path to the SSH private key file.
 * @property {string | null} privateKey - Raw SSH private key contents.
 * @property {string | null} password - Remote SSH password used through SSH_ASKPASS.
 * @property {boolean} strictHostKeyChecking - Whether the OpenSSH client should verify host keys.
 * @property {string | null} knownHostsPath - Optional known_hosts file override.
 */

/**
 * Print CLI usage for the deploy SSH helper.
 * @returns {void}
 */
function printUsage() {
  console.log(`Usage:
  npm run ssh:connect
  npm run ssh:connect -- --command "pwd && ls -la"
  npm run ssh:connect -- -- -L 8085:127.0.0.1:8085

Options:
  --command, -c   Run one remote command instead of opening an interactive shell.
  --env-file      Override the env file path. Defaults to ${DEFAULT_ENV_FILE}
  --help, -h      Show this message.

Reads SSH settings from ${DEFAULT_ENV_FILE} or the current shell env.
Supports key-based auth plus an optional PFB_DEPLOY_SSH_PASSWORD fallback.
See ${EXAMPLE_ENV_FILE} for the supported variables.`)
}

/**
 * Normalize a CLI-supplied file path against the repo root.
 * @param {string} filePath - Relative or absolute path.
 * @returns {string}
 */
function resolveCliPath(filePath) {
  if (path.isAbsolute(filePath)) {
    return filePath
  }

  return path.resolve(ROOT_DIR, filePath)
}

/**
 * Parse helper flags while leaving raw SSH flags untouched.
 * @param {string[]} argv - CLI args after the script path.
 * @returns {{ help: boolean, command: string | null, envFile: string, sshArgs: string[] }}
 */
function parseCliArgs(argv) {
  const cliArgs = {
    help: false,
    command: null,
    envFile: DEFAULT_ENV_FILE,
    sshArgs: [],
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--') {
      cliArgs.sshArgs.push(...argv.slice(index + 1))
      break
    }

    if (arg === '--help' || arg === '-h') {
      cliArgs.help = true
      continue
    }

    if (arg === '--command' || arg === '-c') {
      if (cliArgs.command !== null) {
        throw new Error('Only one --command value can be provided.')
      }

      index += 1
      if (index >= argv.length) {
        throw new Error('Missing value for --command.')
      }

      cliArgs.command = argv[index]
      continue
    }

    if (arg === '--env-file') {
      index += 1
      if (index >= argv.length) {
        throw new Error('Missing value for --env-file.')
      }

      cliArgs.envFile = resolveCliPath(argv[index])
      continue
    }

    cliArgs.sshArgs.push(arg)
  }

  return cliArgs
}

/**
 * Collapse blank env values to null.
 * @param {string | undefined} value - Candidate env value.
 * @returns {string | null}
 */
function normalizeOptional(value) {
  if (value === undefined) {
    return null
  }

  const normalizedValue = String(value).trim()
  return normalizedValue ? normalizedValue : null
}

/**
 * Resolve an optional path relative to the env file location.
 * @param {string | null} filePath - Candidate relative or absolute path.
 * @param {string} baseDir - Directory that owns the env file.
 * @returns {string | null}
 */
function resolveOptionalPath(filePath, baseDir) {
  if (!filePath) {
    return null
  }

  return path.isAbsolute(filePath) ? filePath : path.resolve(baseDir, filePath)
}

/**
 * Parse a boolean env variable with a default fallback.
 * @param {string | undefined} value - Raw env value.
 * @param {boolean} defaultValue - Fallback when the value is unset.
 * @param {string} variableName - Env variable name for error messages.
 * @returns {boolean}
 */
function parseBoolean(value, defaultValue, variableName) {
  const normalizedValue = normalizeOptional(value)
  if (!normalizedValue) {
    return defaultValue
  }

  const lowerCaseValue = normalizedValue.toLowerCase()
  if (['1', 'true', 'yes', 'on'].includes(lowerCaseValue)) {
    return true
  }

  if (['0', 'false', 'no', 'off'].includes(lowerCaseValue)) {
    return false
  }

  throw new Error(`${variableName} must be true or false.`)
}

/**
 * Create a validated SSH config from env values.
 * @param {Record<string, string | undefined>} env - Environment values to read.
 * @param {string} baseDir - Directory that owns the env file.
 * @param {string} envFilePath - Path to the env file used for error messages.
 * @returns {DeploySshConfig}
 */
function createDeployConfigFromEnv(env, baseDir, envFilePath) {
  const host = normalizeOptional(env.PFB_DEPLOY_SSH_HOST)
  const user = normalizeOptional(env.PFB_DEPLOY_SSH_USER)
  const port = normalizeOptional(env.PFB_DEPLOY_SSH_PORT) || '22'
  const privateKeyPath = resolveOptionalPath(normalizeOptional(env.PFB_DEPLOY_SSH_PRIVATE_KEY_PATH), baseDir)
  const privateKey = normalizeOptional(env.PFB_DEPLOY_SSH_PRIVATE_KEY)
  const password = normalizeOptional(env.PFB_DEPLOY_SSH_PASSWORD)
  const knownHostsPath = resolveOptionalPath(normalizeOptional(env.PFB_DEPLOY_SSH_KNOWN_HOSTS_PATH), baseDir)
  const strictHostKeyChecking = parseBoolean(
    env.PFB_DEPLOY_SSH_STRICT_HOST_KEY_CHECKING,
    true,
    'PFB_DEPLOY_SSH_STRICT_HOST_KEY_CHECKING'
  )

  const missingVariables = []
  if (!host) missingVariables.push('PFB_DEPLOY_SSH_HOST')
  if (!user) missingVariables.push('PFB_DEPLOY_SSH_USER')

  if (missingVariables.length > 0) {
    throw new Error(
      `Missing required SSH settings (${missingVariables.join(', ')}). ` +
      `Set them in ${envFilePath} or export them in your shell. See ${EXAMPLE_ENV_FILE}.`
    )
  }

  if (privateKeyPath && privateKey) {
    throw new Error('Set either PFB_DEPLOY_SSH_PRIVATE_KEY_PATH or PFB_DEPLOY_SSH_PRIVATE_KEY, not both.')
  }

  if (privateKeyPath && !fs.existsSync(privateKeyPath)) {
    throw new Error(`SSH private key file not found: ${privateKeyPath}`)
  }

  if (knownHostsPath && !fs.existsSync(knownHostsPath)) {
    throw new Error(`Known hosts file not found: ${knownHostsPath}`)
  }

  return {
    host,
    user,
    port,
    privateKeyPath,
    privateKey,
    password,
    strictHostKeyChecking,
    knownHostsPath,
  }
}

/**
 * Load and merge the shared local env file with the current shell env.
 * @param {string} envFilePath - Absolute path to the env file.
 * @returns {DeploySshConfig}
 */
function loadDeployConfig(envFilePath) {
  const baseDir = path.dirname(envFilePath)
  let envFromFile = {}

  if (fs.existsSync(envFilePath)) {
    envFromFile = dotenv.parse(fs.readFileSync(envFilePath, 'utf8'))
  }

  return createDeployConfigFromEnv({
    ...envFromFile,
    ...process.env,
  }, baseDir, envFilePath)
}

/**
 * Normalize inline private key contents before writing them to disk.
 * @param {string} privateKey - Raw private key string.
 * @returns {string}
 */
function normalizePrivateKey(privateKey) {
  const normalizedKey = String(privateKey)
    .replace(/\r\n/g, '\n')
    .replace(/\\n/g, '\n')
    .trim()

  return normalizedKey.endsWith('\n') ? normalizedKey : `${normalizedKey}\n`
}

/**
 * Write an inline private key to a short-lived temp file.
 * @param {string} privateKey - Raw private key contents.
 * @returns {{ keyPath: string, cleanup: () => void }}
 */
function createTemporaryPrivateKeyFile(privateKey) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pfb-deploy-ssh-'))
  const keyPath = path.join(tempDir, 'id_deploy')

  fs.writeFileSync(keyPath, normalizePrivateKey(privateKey), { mode: 0o600 })

  return {
    keyPath,
    cleanup: () => {
      fs.rmSync(tempDir, { recursive: true, force: true })
    },
  }
}

/**
 * Write a short-lived askpass script so OpenSSH can use an env-provided password.
 * @param {string} password - Raw SSH password.
 * @returns {{ askpassPath: string, cleanup: () => void }}
 */
function createTemporaryAskpassScript(password) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pfb-deploy-askpass-'))
  const askpassPath = path.join(tempDir, 'askpass.sh')
  const passwordPath = path.join(tempDir, 'password')

  fs.writeFileSync(passwordPath, `${password}\n`, { mode: 0o600 })
  fs.writeFileSync(askpassPath, '#!/bin/sh\ncat "$(dirname "$0")/password"\n', { mode: 0o700 })

  return {
    askpassPath,
    cleanup: () => {
      fs.rmSync(tempDir, { recursive: true, force: true })
    },
  }
}

/**
 * Build the final OpenSSH argument list.
 * @param {DeploySshConfig} config - Validated SSH config.
 * @param {{ command: string | null, sshArgs: string[], privateKeyPath?: string | null }} options - CLI-specific options.
 * @returns {string[]}
 */
function buildSshArgs(config, options) {
  const sshArgs = ['-p', config.port]
  const privateKeyPath = options.privateKeyPath || config.privateKeyPath

  if (privateKeyPath) {
    sshArgs.push('-i', privateKeyPath, '-o', 'IdentitiesOnly=yes')
  }

  if (config.knownHostsPath) {
    sshArgs.push('-o', `UserKnownHostsFile=${config.knownHostsPath}`)
  }

  if (!config.strictHostKeyChecking) {
    sshArgs.push('-o', 'StrictHostKeyChecking=no')
  }

  sshArgs.push(...options.sshArgs)
  sshArgs.push(`${config.user}@${config.host}`)

  if (options.command) {
    sshArgs.push(options.command)
  }

  return sshArgs
}

/**
 * Prepare a temporary key file when the env contains an inline private key.
 * @param {DeploySshConfig} config - Validated SSH config.
 * @param {{ command: string | null, sshArgs: string[] }} cliArgs - Parsed CLI args.
 * @returns {{ sshArgs: string[], env: NodeJS.ProcessEnv, cleanup: () => void }}
 */
function prepareSshCommand(config, cliArgs) {
  const cleanupCallbacks = []
  let privateKeyPath = config.privateKeyPath
  const env = { ...process.env }

  if (config.privateKey) {
    const temporaryKey = createTemporaryPrivateKeyFile(config.privateKey)
    privateKeyPath = temporaryKey.keyPath
    cleanupCallbacks.push(temporaryKey.cleanup)
  }

  if (config.password) {
    const temporaryAskpass = createTemporaryAskpassScript(config.password)
    env.SSH_ASKPASS = temporaryAskpass.askpassPath
    env.SSH_ASKPASS_REQUIRE = 'force'
    env.DISPLAY = env.DISPLAY || 'pfb-deploy-ssh'
    cleanupCallbacks.push(temporaryAskpass.cleanup)
  }

  return {
    sshArgs: buildSshArgs(config, {
      ...cliArgs,
      privateKeyPath,
    }),
    env,
    cleanup: () => {
      for (const cleanup of cleanupCallbacks.reverse()) {
        cleanup()
      }
    },
  }
}

/**
 * Ensure the local OpenSSH client is available before attempting a connection.
 * @returns {void}
 */
function ensureSshClient() {
  const versionCheck = spawnSync('ssh', ['-V'], { stdio: 'ignore' })

  if (versionCheck.error) {
    throw new Error('The OpenSSH client is not available on PATH.')
  }
}

/**
 * Open the remote SSH session or run the requested one-off command.
 * @returns {void}
 */
function main() {
  const cliArgs = parseCliArgs(process.argv.slice(2))
  if (cliArgs.help) {
    printUsage()
    return
  }

  ensureSshClient()
  const config = loadDeployConfig(cliArgs.envFile)
  const sshCommand = prepareSshCommand(config, cliArgs)

  try {
    const result = spawnSync('ssh', sshCommand.sshArgs, {
      stdio: 'inherit',
      env: sshCommand.env,
    })

    if (result.error) {
      throw result.error
    }

    process.exitCode = typeof result.status === 'number' ? result.status : 1
  } finally {
    sshCommand.cleanup()
  }
}

if (require.main === module) {
  try {
    main()
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}

module.exports = {
  DEFAULT_ENV_FILE,
  EXAMPLE_ENV_FILE,
  buildSshArgs,
  createDeployConfigFromEnv,
  createTemporaryAskpassScript,
  createTemporaryPrivateKeyFile,
  ensureSshClient,
  loadDeployConfig,
  normalizePrivateKey,
  parseBoolean,
  parseCliArgs,
  prepareSshCommand,
  resolveCliPath,
  resolveOptionalPath,
}
