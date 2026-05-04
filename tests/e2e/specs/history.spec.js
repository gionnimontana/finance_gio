const { test, expect } = require('@playwright/test')

const { HISTORY_USER_PASSWORD } = require('../fixtures/users')
const { canvasHasPaint, openAuthenticatedPage } = require('../helpers/app')

test('renders historical summaries, chart, and monthly table', async ({ page }) => {
  await openAuthenticatedPage(page, '/history/', HISTORY_USER_PASSWORD)

  await expect(page.locator('#current_total')).toContainText('€23,500')
  await expect(page.locator('#avg_growth')).toContainText('%')
  await expect(page.locator('#total_change')).toContainText('3,300')
  await expect(page.locator('#history_table table tbody tr')).toHaveCount(5)
  await expect(page.locator('#history_table')).toContainText('Month')
  await expect(page.locator('#history_table')).toHaveCSS('overflow-y', 'auto')
  await expect(page.locator('#history_table thead th').first()).toHaveCSS('position', 'sticky')
  await expect(page.locator('#history_table thead th').first()).toHaveCSS('top', '0px')
  await expect(page.locator('#history_table thead th.col-equity')).toHaveCSS('background-color', 'rgb(228, 243, 229)')
  expect(await canvasHasPaint(page, '#history_chart')).toBeTruthy()

  await page.locator('#abs_toggle_btn').click()
  await expect(page.locator('body')).toHaveClass(/hide_absolute/)
  await expect(page.locator('#total_change')).toContainText('%')
  await expect(page.locator('#total_change')).not.toContainText('(')
})

test('keeps compact canvas labels when the compact-values setting is disabled', async ({ page }) => {
  await page.addInitScript(() => {
    window.__canvasTextLog = {}

    const originalGetContext = HTMLCanvasElement.prototype.getContext
    HTMLCanvasElement.prototype.getContext = function (...args) {
      const context = originalGetContext.apply(this, args)
      if (!context || args[0] !== '2d' || context.__textCapturePatched) {
        return context
      }

      const canvas = this
      const originalFillText = context.fillText.bind(context)
      context.fillText = function (text, ...fillArgs) {
        const canvasId = canvas.id || 'unknown'
        window.__canvasTextLog[canvasId] ??= []
        window.__canvasTextLog[canvasId].push(String(text))
        return originalFillText(text, ...fillArgs)
      }
      context.__textCapturePatched = true

      return context
    }
  })

  await openAuthenticatedPage(page, '/history/', HISTORY_USER_PASSWORD)

  await expect(page.locator('#current_total')).toContainText('€23,500')

  const chartLabels = await page.evaluate(() => window.__canvasTextLog.history_chart ?? [])
  expect(chartLabels).toContain('23.5k')
  expect(chartLabels).not.toContain('23,500')
})