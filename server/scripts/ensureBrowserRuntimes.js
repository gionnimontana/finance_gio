/**
 * Ensure Playwright and Puppeteer browser runtimes exist before running local e2e commands.
 */
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const { chromium } = require('@playwright/test')
const puppeteer = require('puppeteer')

const repoRoot = path.resolve(__dirname, '..', '..')
const playwrightCliPath = path.join(repoRoot, 'node_modules', 'playwright', 'cli.js')
const puppeteerInstallerPath = require.resolve('puppeteer/install.mjs')

/**
 * Run a local Node script with inherited stdio.
 * @param {string} scriptPath - Absolute script path.
 * @param {string[]} [args=[]] - CLI arguments.
 * @returns {void}
 */
const runNodeScript = (scriptPath, args = []) => {
  execFileSync(process.execPath, [scriptPath, ...args], {
    cwd: repoRoot,
    stdio: 'inherit',
  })
}

/**
 * Ensure Playwright browser assets used by the e2e suite are present.
 * @returns {void}
 */
const ensurePlaywrightBrowsers = () => {
  if (!fs.existsSync(playwrightCliPath)) {
    throw new Error('Playwright CLI not found. Run npm install with Node 24.15.0 or newer.')
  }

  if (fs.existsSync(chromium.executablePath())) {
    return
  }

  runNodeScript(playwrightCliPath, ['install', 'chromium', 'ffmpeg'])
}

/**
 * Resolve whether Puppeteer already has a Chrome binary available.
 * @returns {Promise<boolean>}
 */
const hasPuppeteerBrowser = async () => {
  try {
    const executablePath = await puppeteer.executablePath()
    return typeof executablePath === 'string' && executablePath.length > 0 && fs.existsSync(executablePath)
  } catch (error) {
    return false
  }
}

/**
 * Ensure Puppeteer's managed Chrome binary is present.
 * @returns {Promise<void>}
 */
const ensurePuppeteerBrowser = async () => {
  if (await hasPuppeteerBrowser()) {
    return
  }

  runNodeScript(puppeteerInstallerPath)
}

/**
 * Ensure both browser toolchains are ready for local automation.
 * @returns {Promise<void>}
 */
const main = async () => {
  ensurePlaywrightBrowsers()
  await ensurePuppeteerBrowser()
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})