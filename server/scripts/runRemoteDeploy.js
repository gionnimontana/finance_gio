// SSH helper for running the checked-in deploy workflow on the remote host.
const fs = require('fs')
const path = require('path')
const dotenv = require('dotenv')
const { spawnSync } = require('child_process')

const deploySsh = require('./connectDeployServer')

const DEFAULT_ENV_FILE = deploySsh.DEFAULT_ENV_FILE
const EXAMPLE_ENV_FILE = deploySsh.EXAMPLE_ENV_FILE

/**
 * @typedef {object} RemoteDeployConfig
 * @property {string} appPath - Absolute app path on the remote server.
 * @property {object} sshConfig - Validated SSH config reused by the remote deploy command.
 */

/**
 * Print CLI usage for the remote deploy helper.
 * @returns {void}
 */
function printUsage() {
  console.log(`Usage:
  npm run deploy:remote
  npm run deploy:remote -- --env-file .env

Options:
  --env-file  Override the env file path. Defaults to ${DEFAULT_ENV_FILE}
  --help, -h  Show this message.

Reads SSH settings plus PFB_DEPLOY_APP_PATH from ${DEFAULT_ENV_FILE} or the current shell env.
Runs "bash ./deploy.sh" inside the configured remote app directory.
See ${EXAMPLE_ENV_FILE} for the supported variables.`)
}

/**
 * Parse CLI args for the remote deploy helper.
 * @param {string[]} argv - CLI args after the script path.
 * @returns {{ help: boolean, envFile: string }}
 */
function parseCliArgs(argv) {
  const cliArgs = {
    help: false,
    envFile: DEFAULT_ENV_FILE,
  }

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--help' || arg === '-h') {
      cliArgs.help = true
      continue
    }

    if (arg === '--env-file') {
      index += 1
      if (index >= argv.length) {
        throw new Error('Missing value for --env-file.')
      }

      cliArgs.envFile = deploySsh.resolveCliPath(argv[index])
      continue
    }

    throw new Error(`Unknown argument: ${arg}`)
  }

  return cliArgs
}

/**
 * Load and merge the shared local env file with the current shell env.
 * @param {string} envFilePath - Absolute path to the env file.
 * @returns {Record<string, string | undefined>}
 */
function loadRemoteDeployEnv(envFilePath) {
  let envFromFile = {}

  if (fs.existsSync(envFilePath)) {
    envFromFile = dotenv.parse(fs.readFileSync(envFilePath, 'utf8'))
  }

  return {
    ...envFromFile,
    ...process.env,
  }
}

/**
 * Read a required non-empty env value.
 * @param {string | undefined} value - Raw env value.
 * @param {string} variableName - Env variable name for error messages.
 * @param {string} envFilePath - Path to the env file used for error messages.
 * @returns {string}
 */
function getRequiredEnvValue(value, variableName, envFilePath) {
  const normalizedValue = value === undefined ? '' : String(value).trim()

  if (!normalizedValue) {
    throw new Error(
      `Missing required remote deploy setting (${variableName}). ` +
      `Set it in ${envFilePath} or export it in your shell. See ${EXAMPLE_ENV_FILE}.`
    )
  }

  return normalizedValue
}

/**
 * Create a validated remote deploy config from env values.
 * @param {Record<string, string | undefined>} env - Environment values to read.
 * @param {string} envFilePath - Path to the env file used for relative path resolution.
 * @returns {RemoteDeployConfig}
 */
function createRemoteDeployConfigFromEnv(env, envFilePath) {
  const baseDir = path.dirname(envFilePath)

  return {
    appPath: getRequiredEnvValue(env.PFB_DEPLOY_APP_PATH, 'PFB_DEPLOY_APP_PATH', envFilePath),
    sshConfig: deploySsh.createDeployConfigFromEnv(env, baseDir, envFilePath),
  }
}

/**
 * Load and validate the remote deploy config from the shared env sources.
 * @param {string} envFilePath - Absolute path to the env file.
 * @returns {RemoteDeployConfig}
 */
function loadRemoteDeployConfig(envFilePath) {
  return createRemoteDeployConfigFromEnv(loadRemoteDeployEnv(envFilePath), envFilePath)
}

/**
 * Quote a shell argument for a remote POSIX shell.
 * @param {string} value - Raw argument value.
 * @returns {string}
 */
function quoteShellArg(value) {
  return `'${String(value).replaceAll("'", "'\\''")}'`
}

/**
 * Build the remote deploy command executed through SSH.
 * @param {string} appPath - Absolute app path on the remote server.
 * @returns {string}
 */
function buildRemoteDeployCommand(appPath) {
  return `cd ${quoteShellArg(appPath)} && bash ./deploy.sh`
}

/**
 * Run deploy.sh on the configured remote host.
 * @returns {void}
 */
function main() {
  const cliArgs = parseCliArgs(process.argv.slice(2))
  if (cliArgs.help) {
    printUsage()
    return
  }

  deploySsh.ensureSshClient()
  const remoteDeployConfig = loadRemoteDeployConfig(cliArgs.envFile)
  const sshCommand = deploySsh.prepareSshCommand(remoteDeployConfig.sshConfig, {
    command: buildRemoteDeployCommand(remoteDeployConfig.appPath),
    sshArgs: [],
  })

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
  buildRemoteDeployCommand,
  createRemoteDeployConfigFromEnv,
  loadRemoteDeployConfig,
  parseCliArgs,
  quoteShellArg,
}