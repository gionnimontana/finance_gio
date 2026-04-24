const crypto = require('crypto')
const fs = require('fs')
const path = require('path')

const {
  EMPTY_USER_PASSWORD,
  DASHBOARD_USER_PASSWORD,
  ASSETS_USER_PASSWORD,
  HISTORY_USER_PASSWORD,
} = require('../fixtures/users')

const rootDir = path.resolve(__dirname, '..', '..', '..')
const runtimeDir = path.join(rootDir, 'tests', 'e2e', '.runtime')
const dataDir = path.join(runtimeDir, 'data')
const usersDir = path.join(dataDir, 'users')
const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

const defaultSchema = {
  assets: [],
  viewGroups: ['Liquidity', 'Crypto', 'Gold', 'Houses', 'Equity'],
  prevMonthTotal: null,
  initYearNetworth: null,
}

const hashPassword = (password) => crypto.createHash('sha256').update(password).digest('hex')

const monthKey = (date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${year}-${month}`
}

const monthLabel = (date) => `${monthNames[date.getMonth()]} ${date.getFullYear()}`

const toHistoryEntry = (date, totals) => ({
  label: monthLabel(date),
  date: monthKey(date),
  total: totals.Liquidity + totals.Crypto + totals.Gold + totals.Houses + totals.Equity,
  Liquidity: { total: totals.Liquidity },
  Crypto: { total: totals.Crypto },
  Gold: { total: totals.Gold },
  Houses: { total: totals.Houses },
  Equity: { total: totals.Equity },
})

const buildHistory = () => {
  const now = new Date()
  const entries = [
    toHistoryEntry(new Date(now.getFullYear() - 1, 11, 1), {
      Liquidity: 1200,
      Crypto: 15500,
      Gold: 500,
      Houses: 0,
      Equity: 800,
    }),
    toHistoryEntry(new Date(now.getFullYear(), now.getMonth() - 3, 1), {
      Liquidity: 1500,
      Crypto: 17000,
      Gold: 700,
      Houses: 0,
      Equity: 1000,
    }),
    toHistoryEntry(new Date(now.getFullYear(), now.getMonth() - 2, 1), {
      Liquidity: 1500,
      Crypto: 18000,
      Gold: 800,
      Houses: 0,
      Equity: 1000,
    }),
    toHistoryEntry(new Date(now.getFullYear(), now.getMonth() - 1, 1), {
      Liquidity: 1500,
      Crypto: 19000,
      Gold: 900,
      Houses: 0,
      Equity: 1000,
    }),
    toHistoryEntry(new Date(now.getFullYear(), now.getMonth(), 1), {
      Liquidity: 1500,
      Crypto: 20000,
      Gold: 1000,
      Houses: 0,
      Equity: 1000,
    }),
  ]

  const deduped = new Map(entries.map(entry => [entry.date, entry]))
  return Array.from(deduped.values()).sort((left, right) => left.date.localeCompare(right.date))
}

const createPopulatedSchema = () => ({
  assets: [
    ['Other', 'cash-wallet', 1500, 'Cash Wallet', 'Liquidity'],
    ['Crypto', 'BTC', 0.5, 'Bitcoin Stack', 'Crypto'],
    ['Gold', 'physical-gold', 20, 'Gold Reserve', 'Gold'],
    ['Isin', 'IE00B4L5Y983', 10, 'World ETF', 'Equity'],
  ],
  viewGroups: ['Liquidity', 'Crypto', 'Gold', 'Houses', 'Equity'],
  prevMonthTotal: 22400,
  initYearNetworth: 18000,
})

const writeJson = (filePath, value) => {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, JSON.stringify(value, null, 2), 'utf8')
}

const writeUser = ({ password, assetsSchema, historicalData }) => {
  const userDir = path.join(usersDir, hashPassword(password))
  fs.mkdirSync(userDir, { recursive: true })
  writeJson(path.join(userDir, 'assetsSchema.json'), assetsSchema)
  writeJson(path.join(userDir, 'historicalData.json'), historicalData)
}

fs.rmSync(runtimeDir, { recursive: true, force: true })
fs.mkdirSync(usersDir, { recursive: true })

writeUser({
  password: EMPTY_USER_PASSWORD,
  assetsSchema: defaultSchema,
  historicalData: [],
})

for (const password of [DASHBOARD_USER_PASSWORD, ASSETS_USER_PASSWORD, HISTORY_USER_PASSWORD]) {
  writeUser({
    password,
    assetsSchema: createPopulatedSchema(),
    historicalData: buildHistory(),
  })
}

console.log(`E2E runtime data prepared in ${runtimeDir}`)