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
    throw new Error('Playwright CLI not found. Run npm install with Node 18.19.1 or newer.')
  }

  if (fs.existsSync(chromium.executablePath())) {
    return
  }

  runNodeScript(playwrightCliPath, ['install', 'chromium', 'ffmpeg'])
}

/**
 * Resolve whether Puppeteer already has a Chrome binary available.
 * @returns {boolean}
 */
const hasPuppeteerBrowser = () => {
  try {
    return fs.existsSync(puppeteer.executablePath())
  } catch (error) {
    return false
  }
}

/**
 * Ensure Puppeteer's managed Chrome binary is present.
 * @returns {void}
 */
const ensurePuppeteerBrowser = () => {
  if (hasPuppeteerBrowser()) {
    return
  }

  runNodeScript(puppeteerInstallerPath)
}

ensurePlaywrightBrowsers()
ensurePuppeteerBrowser()