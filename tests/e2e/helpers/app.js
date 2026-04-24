const { expect } = require('@playwright/test')

const PASSWORD_KEY = 'userPassword'

const storePassword = async (page, password) => {
  await page.goto('/login/')
  await page.evaluate(({ key, value }) => {
    window.localStorage.setItem(key, value)
  }, { key: PASSWORD_KEY, value: password })
}

const openAuthenticatedPage = async (page, targetPath, password) => {
  await storePassword(page, password)
  await page.goto(targetPath)
}

const loginThroughUi = async (page, password) => {
  await page.goto('/login/')
  await page.locator('#password_input').fill(password)
  await page.locator('#login_btn').click()
  await expect(page).toHaveURL(/\/dashboard\/$/)
}

const readAssetIds = async (page) => {
  return page.locator('#assets_tbody tr td:nth-child(2) input').evaluateAll(inputs => inputs.map(input => input.value))
}

const canvasHasPaint = async (page, selector) => {
  return page.locator(selector).evaluate((canvas) => {
    const context = canvas.getContext('2d')
    const { data } = context.getImageData(0, 0, canvas.width, canvas.height)
    return data.some(channel => channel !== 0)
  })
}

module.exports = {
  canvasHasPaint,
  loginThroughUi,
  openAuthenticatedPage,
  readAssetIds,
  storePassword,
}