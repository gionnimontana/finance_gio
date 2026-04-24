const { test, expect } = require('@playwright/test')

const { DASHBOARD_USER_PASSWORD } = require('../fixtures/users')
const { canvasHasPaint, openAuthenticatedPage } = require('../helpers/app')

test('refreshes the dashboard through SSE and updates the summary @smoke', async ({ page }) => {
  await openAuthenticatedPage(page, '/dashboard/', DASHBOARD_USER_PASSWORD)

  await expect(page.locator('#table_view .row')).toHaveCount(4)
  await expect(page.locator('#total_value')).toContainText('23500.00')

  await page.locator('#refresh_button').click()

  await expect(page.locator('#progress_banner')).toHaveClass(/visible/)
  await expect(page.locator('#progress_banner')).toHaveClass(/completed/)
  await expect(page.locator('#progress_counter')).toHaveText('3/3')
  await expect(page.getByTestId('progress-asset-BTC')).toBeVisible()
  await expect(page.getByTestId('progress-asset-IE00B4L5Y983')).toBeVisible()
  await expect(page.getByTestId('progress-asset-physical-gold')).toBeVisible()
  await expect(page.locator('#last_update_value')).not.toHaveText('—')
  await expect(page.locator('#error_banner')).not.toHaveClass(/visible/)
  expect(await canvasHasPaint(page, '#portfolio_chart')).toBeTruthy()

  await page.locator('#abs_toggle_btn').click()
  await expect(page.locator('body')).toHaveClass(/hide_absolute/)
})

test('falls back to a regular refresh when the event stream cannot connect', async ({ page }) => {
  await openAuthenticatedPage(page, '/dashboard/', DASHBOARD_USER_PASSWORD)

  await page.route(/\/portfolio\/stream\?password=.*/, route => route.abort('failed'))
  const fallbackResponse = page.waitForResponse(response => response.url().includes('/portfolio?refresh=true') && response.ok())

  await page.locator('#refresh_button').click()
  await fallbackResponse

  await expect(page.locator('#progress_banner')).not.toHaveClass(/visible/)
  await expect(page.locator('#total_value')).toContainText('23500.00')
})