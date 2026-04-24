const { test, expect } = require('@playwright/test')

const { HISTORY_USER_PASSWORD } = require('../fixtures/users')
const { canvasHasPaint, openAuthenticatedPage } = require('../helpers/app')

test('renders historical summaries, chart, and monthly table', async ({ page }) => {
  await openAuthenticatedPage(page, '/history/', HISTORY_USER_PASSWORD)

  await expect(page.locator('#current_total')).toContainText('€23500.00')
  await expect(page.locator('#avg_growth')).toContainText('%')
  await expect(page.locator('#total_change')).toContainText('3300.00')
  await expect(page.locator('#history_table table tbody tr')).toHaveCount(5)
  await expect(page.locator('#history_table')).toContainText('Month')
  expect(await canvasHasPaint(page, '#history_chart')).toBeTruthy()

  await page.locator('#abs_toggle_btn').click()
  await expect(page.locator('body')).toHaveClass(/hide_absolute/)
})