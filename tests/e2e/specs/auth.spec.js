const { test, expect } = require('@playwright/test')

const { DASHBOARD_USER_PASSWORD } = require('../fixtures/users')
const { storePassword } = require('../helpers/app')

test('shows an error for invalid credentials @smoke', async ({ page }) => {
  await page.goto('/login/')
  await page.locator('#password_input').fill('invalid-password')
  await page.locator('#login_btn').click()

  await expect(page.locator('#error_banner')).toContainText('Invalid password')
  await expect(page).toHaveURL(/\/login\/$/)
})

test('creates a new account and reaches the dashboard @smoke', async ({ page }) => {
  await page.goto('/login/')
  await page.locator('#generate_btn').click()

  await expect(page.locator('#generated_password')).toBeVisible()
  await expect(page.locator('#new_password')).toHaveText(/^[a-z]+(-[a-z]+){4}$/)

  await page.locator('#continue_btn').click()
  await expect(page).toHaveURL(/\/dashboard\/$/)
  await expect(page.locator('#total_value')).toContainText('0.00')
  await expect(page.locator('#table_view .row')).toHaveCount(0)
})

test('redirects away from login when a valid password is already stored', async ({ page }) => {
  await storePassword(page, DASHBOARD_USER_PASSWORD)
  await page.goto('/login/')

  await expect(page).toHaveURL(/\/dashboard\/$/)
  await expect(page.locator('#total_value')).toContainText('23500.00')
})