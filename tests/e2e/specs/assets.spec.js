const { test, expect } = require('@playwright/test')

const { ASSETS_USER_PASSWORD, DASHBOARD_USER_PASSWORD } = require('../fixtures/users')
const { openAuthenticatedPage, readAssetIds } = require('../helpers/app')

test('manages assets, view groups, password export, and logout @smoke', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: async () => {},
      },
    })
  })

  await openAuthenticatedPage(page, '/assets/', ASSETS_USER_PASSWORD)

  await expect(page.locator('#assets_tbody tr')).toHaveCount(4)
  await expect(page.getByTestId('view-group-row-Crypto').getByRole('button', { name: 'Delete' })).toBeDisabled()

  await page.locator('#add_btn').click()
  await expect(page.locator('#assets_tbody tr')).toHaveCount(5)

  let newRow = page.locator('#assets_tbody tr').last()
  let assetIdInput = newRow.locator('td').nth(1).locator('input')
  await assetIdInput.fill('bonus-fund')
  await assetIdInput.press('Tab')

  newRow = page.locator('#assets_tbody tr').last()
  let quantityInput = newRow.locator('td').nth(2).locator('input')
  await quantityInput.fill('2500')
  await quantityInput.press('Tab')

  newRow = page.locator('#assets_tbody tr').last()
  let displayNameInput = newRow.locator('td').nth(3).locator('input')
  await displayNameInput.fill('Bonus Fund')
  await displayNameInput.press('Tab')

  await expect(page.locator('#assets_tbody tr').last().locator('td').nth(2).locator('input')).toHaveValue('2500')

  let assetIds = await readAssetIds(page)
  const beforeMoveIndex = assetIds.indexOf('bonus-fund')
  await page.locator('#assets_tbody tr').nth(beforeMoveIndex).getByRole('button', { name: 'Up' }).click()

  const movedIds = await readAssetIds(page)
  expect(movedIds.indexOf('bonus-fund')).toBe(beforeMoveIndex - 1)

  await page.getByTestId('asset-row-physical-gold').getByRole('button', { name: 'Delete' }).click()
  await expect(page.locator('#assets_tbody tr')).toHaveCount(4)

  await page.locator('#save_btn').click()
  await expect(page.locator('#success_banner')).toContainText('Saved')
  await expect(page.getByTestId('asset-row-bonus-fund')).toBeVisible()
  await expect(page.getByTestId('asset-row-physical-gold')).toHaveCount(0)

  const cryptoGroupInput = page.getByTestId('view-group-row-Crypto').locator('input')
  await cryptoGroupInput.fill('Digital Assets')
  await cryptoGroupInput.press('Tab')
  await page.locator('#groups_save_btn').click()
  await expect(page.locator('#success_banner')).toContainText('Groups saved')
  await expect(page.getByTestId('view-group-row-Digital-Assets')).toBeVisible()
  await expect(page.getByTestId('asset-row-BTC').locator('td').nth(4).locator('select')).toHaveValue('Digital Assets')

  await page.locator('#toggle_password_btn').click()
  await expect(page.locator('#export_password')).toHaveAttribute('type', 'text')
  await page.locator('#export_password_btn').click()
  await expect(page.locator('#success_banner')).toContainText('Password copied to clipboard')

  await page.getByRole('button', { name: '🚪 Logout' }).click()
  await expect(page).toHaveURL(/\/login\/$/)
})

test('enables compact absolute values from settings', async ({ page }) => {
  await openAuthenticatedPage(page, '/assets/', DASHBOARD_USER_PASSWORD)

  const compactToggle = page.locator('#compact_values_toggle')
  await expect(compactToggle).not.toBeChecked()

  await compactToggle.check()

  await page.goto('/dashboard/')
  await expect(page.locator('#total_value')).toContainText('€23.5k')

  await page.goto('/history/')
  await expect(page.locator('#current_total')).toContainText('€23.5k')

  await page.goto('/assets/')
  await expect(page.locator('#compact_values_toggle')).toBeChecked()
})

test('enables hidden absolute values from settings', async ({ page }) => {
  await openAuthenticatedPage(page, '/assets/', DASHBOARD_USER_PASSWORD)

  const hideAbsoluteToggle = page.locator('#hide_absolute_toggle')
  await expect(hideAbsoluteToggle).not.toBeChecked()

  await hideAbsoluteToggle.check()

  await page.goto('/dashboard/')
  await expect(page.locator('body')).toHaveClass(/hide_absolute/)

  await page.goto('/history/')
  await expect(page.locator('body')).toHaveClass(/hide_absolute/)

  await page.goto('/assets/')
  await expect(page.locator('#hide_absolute_toggle')).toBeChecked()
})