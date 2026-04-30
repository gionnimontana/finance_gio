const { test, expect } = require('@playwright/test')

const { DASHBOARD_USER_PASSWORD } = require('../fixtures/users')
const { canvasHasPaint, openAuthenticatedPage, storePassword } = require('../helpers/app')

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const currentMonthLabel = () => {
  const now = new Date()
  return `${monthNames[now.getMonth()]} ${now.getFullYear()}`
}

test('streams per-asset progress on the first dashboard load without cache', async ({ page }) => {
  await storePassword(page, DASHBOARD_USER_PASSWORD)

  await page.route(/\/portfolio\?refresh=false$/, route => route.abort('failed'))

  await page.goto('/dashboard/')

  await expect(page.locator('#progress_banner')).toHaveClass(/visible/)
  await expect(page.locator('#progress_banner')).toHaveClass(/completed/)
  await expect(page.locator('#progress_counter')).toHaveText('3/3')
  await expect(page.getByTestId('progress-asset-BTC')).toBeVisible()
  await expect(page.getByTestId('progress-asset-IE00B4L5Y983')).toBeVisible()
  await expect(page.getByTestId('progress-asset-physical-gold')).toBeVisible()
  await expect(page.locator('#total_value')).toContainText('23.5k')
  await expect(page.locator('#ath_distance_value')).toContainText('At ATH')
  await expect(page.locator('#ath_distance_value')).toContainText(currentMonthLabel())
  await expect(page.locator('#ath_distance_value')).toContainText('🤩')
})

test('refreshes the dashboard through SSE and updates the summary @smoke', async ({ page }) => {
  await openAuthenticatedPage(page, '/dashboard/', DASHBOARD_USER_PASSWORD)

  await expect(page.locator('#table_view .row')).toHaveCount(4)
  await expect(page.locator('#total_value')).toContainText('23.5k')

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
  await expect(page.locator('#ath_distance_value')).toContainText('At ATH')
  await expect(page.locator('#ath_distance_value')).toContainText(currentMonthLabel())
  await expect(page.locator('#ath_distance_value .abs_value')).toHaveCount(1)
  expect(await page.locator('#ath_distance_value .abs_value').evaluateAll(nodes => nodes.every(node => getComputedStyle(node).display === 'none'))).toBeTruthy()
})

test('falls back to a regular refresh when the event stream cannot connect', async ({ page }) => {
  await openAuthenticatedPage(page, '/dashboard/', DASHBOARD_USER_PASSWORD)

  await page.route(/\/portfolio\/stream\?password=.*/, route => route.abort('failed'))
  const fallbackResponse = page.waitForResponse(response => response.url().includes('/portfolio?refresh=true') && response.ok())

  await page.locator('#refresh_button').click()
  await fallbackResponse

  await expect(page.locator('#progress_banner')).not.toHaveClass(/visible/)
  await expect(page.locator('#total_value')).toContainText('23.5k')
})

test('refreshes stale cached dashboard data after assets change in another session', async ({ browser }) => {
  const deviceA = await browser.newContext()
  const deviceB = await browser.newContext()
  const pageA = await deviceA.newPage()
  const pageB = await deviceB.newPage()

  try {
    await storePassword(pageA, DASHBOARD_USER_PASSWORD)
    await storePassword(pageB, DASHBOARD_USER_PASSWORD)

    await pageB.goto('/dashboard/')
    await expect(pageB.locator('#table_view .row')).toHaveCount(4)
    await expect(pageB.locator('#table_view')).not.toContainText('Bonus Fund')

    await pageA.goto('/assets/')
    await pageA.locator('#add_btn').click()

    const newRow = pageA.locator('#assets_tbody tr').last()
    await newRow.locator('td').nth(1).locator('input').fill('bonus-fund')
    await newRow.locator('td').nth(1).locator('input').press('Tab')
    await newRow.locator('td').nth(2).locator('input').fill('2500')
    await newRow.locator('td').nth(2).locator('input').press('Tab')
    await newRow.locator('td').nth(3).locator('input').fill('Bonus Fund')
    await newRow.locator('td').nth(3).locator('input').press('Tab')
    await pageA.locator('#save_btn').click()
    await expect(pageA.locator('#success_banner')).toContainText('Saved')

    await pageB.reload()

    await expect(pageB.locator('#table_view .row')).toHaveCount(4)
    await expect(pageB.locator('#table_view')).toContainText('Bonus Fund')
    await expect(pageB.locator('#total_value')).toContainText('26k')
  } finally {
    await deviceA.close()
    await deviceB.close()
  }
})

test('shows the deep drawdown ATH face from cached portfolio data', async ({ page }) => {
  await page.addInitScript((portfolio) => {
    window.localStorage.setItem('portfolio', JSON.stringify(portfolio))
  }, {
    total: 23500,
    prevMonthTotal: 22400,
    initYearNetworth: 18000,
    allTimeHighTotal: 47000,
    allTimeHighLabel: 'Jan 2025',
    Liquidity: {
      total: 1500,
      details: {
        'cash-wallet': { total: 1500, displayName: 'Cash Wallet' },
      },
    },
    Crypto: {
      total: 20000,
      details: {
        BTC: { total: 20000, displayName: 'Bitcoin Stack' },
      },
    },
    Gold: {
      total: 1000,
      details: {
        'physical-gold': { total: 1000, displayName: 'Gold Reserve' },
      },
    },
    Houses: { total: 0, details: {} },
    Equity: {
      total: 1000,
      details: {
        IE00B4L5Y983: { total: 1000, displayName: 'World ETF' },
      },
    },
  })

  await storePassword(page, DASHBOARD_USER_PASSWORD)

  await page.goto('/dashboard/')

  await expect(page.locator('#ath_distance_value')).toContainText('(-50.00%)')
  await expect(page.locator('#ath_distance_value')).toContainText('Jan 2025')
  await expect(page.locator('#ath_distance_value')).toContainText('😭')
})