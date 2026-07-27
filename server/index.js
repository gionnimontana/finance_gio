// Backend HTTP entrypoint that boots Express routes and static frontend hosting.
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env') })

const express = require('express')
const portfolioScripts = require('./scripts/portfolio')
const riskIndicatorScripts = require('./scripts/riskIndicators')
const {
  buildAssetsSchemaCacheKey,
  getHistoricalData,
  updateHistoricalData,
  getAssetsSchema,
  updateAssetsSchema,
  updateViewGroups,
  updateRiskOverrides,
} = require('./api')
const {
  handleGenerate,
  handleValidate,
  authMiddleware,
  hashPassword,
  userExists,
  deleteUser,
} = require('./auth')
const {
  loadPersistedIsinRiskCacheIntoRuntime,
} = require('./api/isinRiskCache')
const {
  loadPersistedCryptoRiskCacheIntoRuntime,
} = require('./api/cryptoRiskCache')
const {
  loadPersistedGoldRiskCacheIntoRuntime,
} = require('./api/goldRiskCache')

const app = express()
const port = Number(process.env.PORT || 8085)
const redirectToHome = (req, res) => res.redirect('/login/')

const isAppRouteRequest = (req) => req.method === 'GET' && path.extname(req.path) === ''

/**
 * Parse a refresh query parameter into a boolean flag.
 * @param {unknown} refresh - Query-string value.
 * @param {boolean} defaultValue - Value to use when the parameter is omitted.
 * @returns {boolean}
 */
const parseRefreshFlag = (refresh, defaultValue) => {
  if (refresh === undefined) {
    return defaultValue
  }

  return String(refresh).toLowerCase() === 'true'
}

/**
 * Build a standard authenticated asset-update route handler.
 * @param {(passwordHash: string, payload: object) => Promise<{ ok: boolean, error?: string, assetsSchema?: object }>} updateAssets - Persistence function to call.
 * @returns {import('express').RequestHandler}
 */
const createAssetUpdateHandler = (updateAssets) => async (req, res) => {
  const result = await updateAssets(req.userPasswordHash, req.body || {})

  if (!result.ok) {
    res.status(400).send({ ok: false, error: result.error })
    return
  }

  res.send({ ok: true, assetsSchema: result.assetsSchema })
}

/**
 * Allow local file:// pages and same-device dev tools to call the API.
 * @param {import('express').Request} req - Incoming request.
 * @param {import('express').Response} res - Outgoing response.
 * @param {import('express').NextFunction} next - Express continuation callback.
 * @returns {void}
 */
const allowCrossOriginRequests = (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*')

  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE')
    res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || 'Content-Type, X-User-Password')
    res.status(204).end()
    return
  }

  next()
}

app.use(allowCrossOriginRequests)
app.use(express.json())
app.use(express.urlencoded({ extended: true }))
app.use(express.static(path.resolve(__dirname, '../view')))

// Legacy base-path support: redirect /financegio/* to root
app.use('/financegio', (req, res) => {
  const target = req.originalUrl.replace(/^\/financegio/, '') || '/'
  res.redirect(301, target)
})

// Auth routes (no authentication required)
app.post('/auth/generate', handleGenerate)
app.post('/auth/validate', handleValidate)
app.delete('/auth/user', authMiddleware, (req, res) => {
  const deleted = deleteUser(req.userPasswordHash)

  if (!deleted) {
    return res.status(404).json({ ok: false, error: 'User data not found' })
  }

  res.json({ ok: true })
})

// Redirect old URLs to new folder structure
app.get('/dashboard.html', (req, res) => res.redirect('/dashboard/'))
app.get('/assets.html', (req, res) => res.redirect('/assets/'))
app.get('/history.html', (req, res) => res.redirect('/history/'))

// Default route redirects to login (which will redirect to dashboard if authenticated)
app.get('/', redirectToHome)

// Simple health endpoint used by automated checks and local test startup.
app.get('/health', (req, res) => {
  res.json({ ok: true })
})

// SSE endpoint for streaming portfolio loads and manual refreshes (requires auth via query param for SSE)
app.get('/portfolio/stream', async (req, res) => {
  // For SSE, we need to get password from query param since headers aren't reliable
  const password = req.query.password || req.headers['x-user-password']
  if (!password) {
    return res.status(401).json({ error: 'Authentication required' })
  }

  const passwordHash = hashPassword(password)
  if (!userExists(passwordHash)) {
    return res.status(401).json({ error: 'Invalid password' })
  }

  const refresh = parseRefreshFlag(req.query.refresh, true)

  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.flushHeaders()

  // Helper to send SSE events
  const sendEvent = (eventType, data) => {
    res.write(`event: ${eventType}\n`)
    res.write(`data: ${JSON.stringify(data)}\n\n`)
  }

  try {
    await portfolioScripts.streamPortfolio(passwordHash, sendEvent, refresh)
  } catch (error) {
    console.error('Stream portfolio error:', error)
    sendEvent('error', { message: error.message })
  }

  res.end()
})

// add support for refresh url param
app.get('/portfolio', authMiddleware, async (req, res) => {
  const params = req.query
  const refresh = parseRefreshFlag(params.refresh, false)
  const passwordHash = req.userPasswordHash
  const portfolio = await portfolioScripts.getPortfolio(passwordHash, refresh)

  // Update historical data with current month values when refresh is triggered
  if (refresh) {
    await updateHistoricalData(passwordHash, portfolio)
  }

  res.send(portfolio)
})

app.get('/portfolio/history', authMiddleware, async (req, res) => {
  const passwordHash = req.userPasswordHash
  const history = await getHistoricalData(passwordHash)
  res.send(history)
})

app.get('/assets/schema', authMiddleware, async (req, res) => {
  const passwordHash = req.userPasswordHash
  const schema = await getAssetsSchema(passwordHash)
  res.send({
    ...schema,
    schemaCacheKey: buildAssetsSchemaCacheKey(schema),
  })
})

app.get('/assets/isin-risk', authMiddleware, async (req, res) => {
  const refresh = parseRefreshFlag(req.query.refresh, false)
  const passwordHash = req.userPasswordHash
  const isinRiskIndicators = await riskIndicatorScripts.getIsinRiskIndicators(passwordHash, refresh)
  res.send({
    values: riskIndicatorScripts.toLegacyRiskValues(isinRiskIndicators.values),
    failures: isinRiskIndicators.failures,
  })
})

app.get('/assets/risk-indicators', authMiddleware, async (req, res) => {
  const refresh = parseRefreshFlag(req.query.refresh, false)
  const passwordHash = req.userPasswordHash
  const riskIndicators = await riskIndicatorScripts.getAssetRiskIndicators(passwordHash, refresh)
  res.send(riskIndicators)
})

app.put('/assets/schema', authMiddleware, createAssetUpdateHandler(updateAssetsSchema))
app.put('/assets/view-groups', authMiddleware, createAssetUpdateHandler(updateViewGroups))
app.put('/assets/risk-overrides', authMiddleware, createAssetUpdateHandler(updateRiskOverrides))

// Normalize unknown app URLs back to the login entrypoint.
app.use((req, res, next) => {
  if (isAppRouteRequest(req)) {
    redirectToHome(req, res)
    return
  }

  next()
})

/**
 * Return a compact error response for unhandled route failures.
 * @param {Error} err - Error forwarded by Express.
 * @param {import('express').Request} req - Incoming request.
 * @param {import('express').Response} res - Outgoing response.
 * @param {import('express').NextFunction} next - Express continuation callback.
 * @returns {void}
 */
const handleUnexpectedError = (err, req, res, next) => {
  console.error('Unhandled request error:', err)

  if (res.headersSent) {
    next(err)
    return
  }

  res.status(500).json({ ok: false, error: 'Internal server error' })
}

app.use(handleUnexpectedError)

const hydratedIsinRiskEntries = loadPersistedIsinRiskCacheIntoRuntime()
const hydratedCryptoRiskEntries = loadPersistedCryptoRiskCacheIntoRuntime()
const hydratedGoldRiskEntries = loadPersistedGoldRiskCacheIntoRuntime()
console.log(`Loaded ${hydratedIsinRiskEntries} shared ISIN risk cache entries`)
console.log(`Loaded ${hydratedCryptoRiskEntries} shared crypto risk cache entries`)
console.log(`Loaded ${hydratedGoldRiskEntries} shared gold risk cache entries`)

app.listen(port, () => {
  console.log(`Personal finance bot listening on port ${port}`)
})
