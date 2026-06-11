const { test, expect } = require('@playwright/test')

const { DASHBOARD_USER_PASSWORD, HISTORY_USER_PASSWORD } = require('../fixtures/users')
const { canvasHasPaint, mockRiskIndicators, openAuthenticatedPage, storePassword } = require('../helpers/app')

const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const previousMonthLabel = () => {
  const date = new Date()
  date.setMonth(date.getMonth() - 1)
  return `${monthNames[date.getMonth()]} ${date.getFullYear()}`
}

const defaultSchema = {
  assets: [
    ['Other', 'cash-wallet', 1500, 'Cash Wallet', 'Liquidity'],
    ['Crypto', 'BTC', 0.5, 'Bitcoin Stack', 'Crypto'],
    ['Gold', 'physical-gold', 20, 'Gold Reserve', 'Gold'],
    ['Isin', 'IE00B4L5Y983', 10, 'World ETF', 'Equity'],
  ],
  viewGroups: ['Liquidity', 'Crypto', 'Gold', 'Houses', 'Equity'],
  prevMonthTotal: 22400,
  initYearNetworth: 18000,
}

const defaultSchemaCacheKey = JSON.stringify({
  assets: defaultSchema.assets,
  viewGroups: defaultSchema.viewGroups,
})

test.beforeEach(async ({ page }) => {
  await mockRiskIndicators(page)
})

test('streams per-asset progress on the first dashboard load without cache', async ({ page }) => {
  await storePassword(page, DASHBOARD_USER_PASSWORD)

  await page.route(/\/portfolio\?refresh=false$/, route => route.abort('failed'))

  await page.goto('/dashboard/')

  await expect(page.locator('#page_loading')).toBeVisible()
  await expect(page.locator('#progress_banner')).toHaveClass(/visible/)
  await expect(page.locator('#progress_banner')).toHaveClass(/completed/)
  await expect(page.locator('#progress_counter')).toHaveText('3/3')
  await expect(page.getByTestId('progress-asset-BTC')).toBeVisible()
  await expect(page.getByTestId('progress-asset-IE00B4L5Y983')).toBeVisible()
  await expect(page.getByTestId('progress-asset-physical-gold')).toBeVisible()
  await expect(page.locator('#table_view')).toContainText('20,000')
  await expect(page.getByTestId('dashboard-asset-risk-cash-wallet')).toHaveText('Risk 1/7')
  await expect(page.getByTestId('dashboard-asset-risk-BTC')).toHaveText('Risk 6/7')
  await expect(page.getByTestId('dashboard-asset-risk-physical-gold')).toHaveText('Risk 2/7')
  await expect(page.getByTestId('dashboard-asset-risk-IE00B4L5Y983')).toHaveText('SRI 4/7')
  await expect(page.getByTestId('dashboard-group-risk-Liquidity')).toHaveText('Risk 1/7')
  await expect(page.getByTestId('dashboard-group-risk-Crypto')).toHaveText('Risk 6/7')
  await expect(page.getByTestId('dashboard-group-risk-Gold')).toHaveText('Risk 2/7')
  await expect(page.getByTestId('dashboard-group-risk-Equity')).toHaveText('Risk 4/7')
  await expect(page.getByTestId('overview-portfolio-risk')).toHaveText('Risk 5.4/7')
  await expect(page.locator('#total_value')).toContainText('€23,500')
  await expect(page.locator('#page_loading')).toBeHidden()
  await expect(page.locator('#table_view .group_row').filter({ hasText: 'Crypto:' }).locator('.mainrow .abs_value')).toContainText('€20,000')
  await expect(page.locator('#table_view .group_row').filter({ hasText: 'Crypto:' }).locator('.subrow_value .abs_value')).toContainText('20,000')
  await expect(page.locator('#table_view .group_row').filter({ hasText: 'Crypto:' }).locator('.subrow_value .abs_value')).not.toContainText('€')
  await expect(page.locator('#ath_distance_value')).toContainText('from €22,400')
  await expect(page.locator('#ath_distance_value')).not.toContainText('ATH')
  await expect(page.locator('#ath_distance_value')).toContainText('4.91%')
  await expect(page.locator('#ath_distance_value')).toContainText(previousMonthLabel())
  await expect(page.locator('#ath_distance_value')).toHaveClass(/positive/)
  await expect(page.locator('#dashboard_title')).toContainText('🤩')
})

test('refreshes the dashboard through SSE and updates the summary @smoke', async ({ page }) => {
  await openAuthenticatedPage(page, '/dashboard/', DASHBOARD_USER_PASSWORD)

  await expect(page.locator('#table_view .row')).toHaveCount(4)
  await expect(page.locator('#total_value')).toContainText('€23,500')
  await expect(page.getByTestId('dashboard-asset-risk-cash-wallet')).toHaveText('Risk 1/7')
  await expect(page.getByTestId('dashboard-asset-risk-BTC')).toHaveText('Risk 6/7')
  await expect(page.getByTestId('dashboard-asset-risk-physical-gold')).toHaveText('Risk 2/7')
  await expect(page.getByTestId('dashboard-asset-risk-IE00B4L5Y983')).toHaveText('SRI 4/7')
  await expect(page.getByTestId('dashboard-group-risk-Liquidity')).toHaveText('Risk 1/7')
  await expect(page.getByTestId('dashboard-group-risk-Crypto')).toHaveText('Risk 6/7')
  await expect(page.getByTestId('dashboard-group-risk-Gold')).toHaveText('Risk 2/7')
  await expect(page.getByTestId('dashboard-group-risk-Equity')).toHaveText('Risk 4/7')
  await expect(page.getByTestId('overview-portfolio-risk')).toHaveText('Risk 5.4/7')

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

  await page.goto('/assets/')
  await page.locator('#hide_absolute_toggle').check()
  await page.goto('/dashboard/')
  await expect(page.locator('body')).toHaveClass(/hide_absolute/)
  await expect(page.locator('#ath_distance_value')).toContainText('from')
  await expect(page.locator('#ath_distance_value')).not.toContainText('ATH')
  await expect(page.locator('#ath_distance_value')).toContainText('4.91%')
  await expect(page.locator('#ath_distance_value')).toContainText(previousMonthLabel())
  await expect(page.locator('#ath_distance_value')).toHaveClass(/positive/)
  await expect(page.locator('#delta_value')).toContainText('%')
  await expect(page.locator('#delta_value')).not.toContainText('(')
  await expect(page.locator('#ath_distance_value .abs_value')).toHaveCount(2)
  expect(await page.locator('#ath_distance_value .abs_value').evaluateAll(nodes => nodes.every(node => getComputedStyle(node).display === 'none'))).toBeTruthy()
})

test('shows risk-indicator failures in the shared dashboard error banner', async ({ page }) => {
  await page.unroute(/\/assets\/risk-indicators\?refresh=(true|false)$/)
  await mockRiskIndicators(page, {
    values: {
      BTC: { value: 6, label: 'Risk' },
    },
    failures: ['IE00B4L5Y983'],
  })

  await openAuthenticatedPage(page, '/dashboard/', DASHBOARD_USER_PASSWORD)

  await expect(page.getByTestId('dashboard-asset-risk-BTC')).toHaveText('Risk 6/7')
  await expect(page.locator('#error_banner')).toHaveClass(/visible/)
  await expect(page.locator('#error_list')).toContainText('Risk indicator unavailable for IE00B4L5Y983')
})

test('groups completed refresh progress by view group and shows grouped diffs', async ({ page }) => {
  const cachedPortfolio = {
    total: 21200,
    prevMonthTotal: 22400,
    initYearNetworth: 18000,
    allTimeHighTotal: 22400,
    allTimeHighLabel: previousMonthLabel(),
    schemaCacheKey: defaultSchemaCacheKey,
    viewGroups: defaultSchema.viewGroups,
    Liquidity: {
      total: 1500,
      details: {
        'cash-wallet': { total: 1500, displayName: 'Cash Wallet' },
      },
    },
    Crypto: {
      total: 18000,
      details: {
        BTC: { total: 18000, displayName: 'Bitcoin Stack' },
      },
    },
    Gold: {
      total: 900,
      details: {
        'physical-gold': { total: 900, displayName: 'Gold Reserve' },
      },
    },
    Houses: { total: 0, details: {} },
    Equity: {
      total: 800,
      details: {
        IE00B4L5Y983: { total: 800, displayName: 'World ETF' },
      },
    },
  }

  await page.addInitScript((portfolio) => {
    window.localStorage.setItem('portfolio', JSON.stringify(portfolio))
  }, cachedPortfolio)

  await openAuthenticatedPage(page, '/dashboard/', DASHBOARD_USER_PASSWORD)

  await expect(page.locator('#total_value')).toContainText('€21,200')

  await page.locator('#refresh_button').click()

  await expect(page.locator('#progress_banner')).toHaveClass(/completed/)
  await expect(page.locator('#progress_assets_list .progress_group_name')).toHaveText(['Crypto:', 'Gold:', 'Equity:'])
  await expect(page.locator('[data-testid="progress-group-Liquidity"]')).toHaveCount(0)
  await expect(page.getByTestId('progress-group-Crypto').locator('.progress_group_diff .abs_value')).toContainText('+€2,000')
  await expect(page.getByTestId('progress-group-Gold').locator('.progress_group_diff .abs_value')).toContainText('+€100')
  await expect(page.getByTestId('progress-group-Equity').locator('.progress_group_diff .abs_value')).toContainText('+€200')
  await expect(page.getByTestId('progress-group-Crypto').getByTestId('progress-asset-BTC')).toBeVisible()
  await expect(page.getByTestId('progress-group-Gold').getByTestId('progress-asset-physical-gold')).toBeVisible()
  await expect(page.getByTestId('progress-group-Equity').getByTestId('progress-asset-IE00B4L5Y983')).toBeVisible()
})

test('falls back to a regular refresh when the event stream cannot connect', async ({ page }) => {
  await openAuthenticatedPage(page, '/dashboard/', DASHBOARD_USER_PASSWORD)

  await page.route(/\/portfolio\/stream\?password=.*/, route => route.abort('failed'))
  const fallbackResponse = page.waitForResponse(response => response.url().includes('/portfolio?refresh=true') && response.ok())

  await page.locator('#refresh_button').click()
  await fallbackResponse

  await expect(page.locator('#progress_banner')).not.toHaveClass(/visible/)
  await expect(page.locator('#total_value')).toContainText('€23,500')
})

test('keeps cached asset rows when a fallback refresh omits failed dynamic assets', async ({ page }) => {
  const cachedPortfolio = {
    total: 21200,
    prevMonthTotal: 22400,
    initYearNetworth: 18000,
    allTimeHighTotal: 22400,
    allTimeHighLabel: previousMonthLabel(),
    schemaCacheKey: defaultSchemaCacheKey,
    viewGroups: defaultSchema.viewGroups,
    failures: [],
    Liquidity: {
      total: 1500,
      details: {
        'cash-wallet': { total: 1500, displayName: 'Cash Wallet' },
      },
    },
    Crypto: {
      total: 18000,
      details: {
        BTC: { total: 18000, displayName: 'Bitcoin Stack' },
      },
    },
    Gold: {
      total: 900,
      details: {
        'physical-gold': { total: 900, displayName: 'Gold Reserve' },
      },
    },
    Houses: { total: 0, details: {} },
    Equity: {
      total: 800,
      details: {
        IE00B4L5Y983: { total: 800, displayName: 'World ETF' },
      },
    },
  }

  const partialRefreshPortfolio = {
    total: 3500,
    prevMonthTotal: 22400,
    initYearNetworth: 18000,
    allTimeHighTotal: 22400,
    allTimeHighLabel: previousMonthLabel(),
    schemaCacheKey: defaultSchemaCacheKey,
    viewGroups: defaultSchema.viewGroups,
    failures: ['Bitcoin Stack'],
    Liquidity: {
      total: 1500,
      details: {
        'cash-wallet': { total: 1500, displayName: 'Cash Wallet' },
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
  }

  await page.addInitScript((portfolio) => {
    window.localStorage.setItem('portfolio', JSON.stringify(portfolio))
  }, cachedPortfolio)

  await openAuthenticatedPage(page, '/dashboard/', DASHBOARD_USER_PASSWORD)

  await page.route(/\/portfolio\/stream\?password=.*/, route => route.abort('failed'))
  await page.route(/\/portfolio\?refresh=true$/, async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(partialRefreshPortfolio),
    })
  })

  await page.locator('#refresh_button').click()

  await expect(page.locator('#error_banner')).toHaveClass(/visible/)
  await expect(page.locator('#error_list')).toContainText('Bitcoin Stack')
  await expect(page.locator('#total_value')).toContainText('€21,500')
  await expect(page.locator('#table_view')).toContainText('Bitcoin Stack')
  await expect(page.locator('#table_view .group_row').filter({ hasText: 'Crypto:' }).locator('.subrow_value .abs_value')).toContainText('18,000')

  const storedPortfolio = await page.evaluate(() => JSON.parse(window.localStorage.getItem('portfolio') || 'null'))
  expect(storedPortfolio.total).toBe(21500)
  expect(storedPortfolio.Crypto.details.BTC.total).toBe(18000)
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
    await expect(pageB.locator('#total_value')).toContainText('€26,000')
  } finally {
    await deviceA.close()
    await deviceB.close()
  }
})

test('shows the deep drawdown ATH face from cached portfolio data', async ({ page }) => {
  const drawdownSchema = {
    assets: [
      ['Other', 'cash-wallet', 1500, 'Cash Wallet', 'Liquidity'],
      ['Crypto', 'BTC', 0.5, 'Bitcoin Stack', 'Crypto'],
      ['Gold', 'physical-gold', 20, 'Gold Reserve', 'Gold'],
      ['Isin', 'IE00B4L5Y983', 10, 'World ETF', 'Equity'],
    ],
    viewGroups: ['Liquidity', 'Crypto', 'Gold', 'Houses', 'Equity'],
  }
  const drawdownPortfolio = {
    total: 23500,
    prevMonthTotal: 22400,
    initYearNetworth: 18000,
    allTimeHighTotal: 47000,
    allTimeHighLabel: 'Jan 2025',
    schemaCacheKey: JSON.stringify(drawdownSchema),
    viewGroups: drawdownSchema.viewGroups,
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
  }

  await page.addInitScript((portfolio) => {
    window.localStorage.setItem('portfolio', JSON.stringify(portfolio))
  }, drawdownPortfolio)

  await storePassword(page, HISTORY_USER_PASSWORD)

  await page.goto('/dashboard/')

  await expect(page.locator('#dashboard_title')).toHaveText('🕵️‍♂️ Billy Tracker 😭')
  await expect(page.locator('#ath_distance_value')).toContainText('(-50.00%)')
  await expect(page.locator('#ath_distance_value')).toContainText('Jan 2025')
  await expect(page.locator('#ath_distance_value')).toHaveClass(/negative/)
  await expect(page.locator('#dashboard_title')).toContainText('😭')

  await page.evaluate((portfolio) => {
    window.localStorage.setItem('portfolio', JSON.stringify(portfolio))
  }, drawdownPortfolio)

  await page.goto('/assets/')
  await page.locator('#hide_absolute_toggle').check()
  await page.goto('/dashboard/')
  await expect(page.locator('body')).toHaveClass(/hide_absolute/)
  await expect(page.locator('#ath_distance_value')).toContainText('-50.00%')
  await expect(page.locator('#ath_distance_value')).not.toContainText('(-50.00%)')
})

test('does not repeat ATH in the exact-peak dashboard summary', async ({ page }) => {
  const atAthSchema = {
    assets: [
      ['Other', 'cash-wallet', 1500, 'Cash Wallet', 'Liquidity'],
      ['Crypto', 'BTC', 0.5, 'Bitcoin Stack', 'Crypto'],
      ['Gold', 'physical-gold', 20, 'Gold Reserve', 'Gold'],
      ['Isin', 'IE00B4L5Y983', 10, 'World ETF', 'Equity'],
    ],
    viewGroups: ['Liquidity', 'Crypto', 'Gold', 'Houses', 'Equity'],
  }
  const atAthPortfolio = {
    total: 23500,
    prevMonthTotal: 22400,
    initYearNetworth: 18000,
    allTimeHighTotal: 23500,
    allTimeHighLabel: previousMonthLabel(),
    schemaCacheKey: JSON.stringify(atAthSchema),
    viewGroups: atAthSchema.viewGroups,
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
  }

  await page.addInitScript((portfolio) => {
    window.localStorage.setItem('portfolio', JSON.stringify(portfolio))
  }, atAthPortfolio)

  await storePassword(page, HISTORY_USER_PASSWORD)

  await page.goto('/dashboard/')

  await expect(page.locator('#ath_distance_value')).toContainText('At €23,500')
  await expect(page.locator('#ath_distance_value')).toContainText(previousMonthLabel())
  await expect(page.locator('#ath_distance_value')).not.toContainText('ATH')
  await expect(page.locator('#ath_distance_value')).toHaveClass(/positive/)
})
