// Backend HTTP entrypoint that boots Express routes and static frontend hosting.
const path = require('path')
require('dotenv').config({ path: path.resolve(__dirname, '../.env') })

const express = require('express')
const cors = require('cors')
const portfolioScripts = require('./scripts/portfolio')
const marketDataScripts = require('./scripts/marketData')
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
const userBlobApi = require('./api/userBlob')
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
 * Resolve the client-derived user id used by the opaque blob API.
 * @param {import('express').Request} req - Express request.
 * @param {import('express').Response} res - Express response.
 * @returns {string|null}
 */
const getOpaqueUserId = (req, res) => {
  const userId = req.headers['x-user-id']

  if (!userBlobApi.isValidUserId(userId)) {
    res.status(400).json({ error: 'Valid X-User-Id header required' })
    return null
  }

  return userBlobApi.normalizeUserId(userId)
}

/**
 * Check whether a thrown error reflects request validation rather than an internal fault.
 * @param {unknown} error - Candidate runtime error.
 * @returns {boolean}
 */
const isRequestValidationError = (error) => error?.name === 'RequestValidationError'

app.use(cors())
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

app.get('/user/blob', (req, res) => {
  const userId = getOpaqueUserId(req, res)
  if (!userId) {
    return
  }

  try {
    const blob = userBlobApi.getUserBlob(userId)

    if (!blob) {
      res.status(404).json({ error: 'User blob not found' })
      return
    }

    res.send(blob)
  } catch (error) {
    console.error('Read user blob error:', error)
    res.status(500).json({ error: 'Failed to read user blob' })
  }
})

app.put('/user/blob', (req, res) => {
  const userId = getOpaqueUserId(req, res)
  if (!userId) {
    return
  }

  if (!userBlobApi.isValidUserBlobEnvelope(req.body || {})) {
    res.status(400).json({ error: 'Invalid user blob envelope' })
    return
  }

  try {
    const result = userBlobApi.putUserBlob(userId, req.body || {})
    res.json({ ok: true, bytes: result.bytes })
  } catch (error) {
    console.error('Write user blob error:', error)

    if (/Invalid user blob envelope|Invalid userId/i.test(error.message)) {
      res.status(400).json({ error: error.message })
      return
    }

    res.status(500).json({ error: 'Failed to persist user blob' })
  }
})

app.delete('/user/blob', (req, res) => {
  const userId = getOpaqueUserId(req, res)
  if (!userId) {
    return
  }

  try {
    const deleted = userBlobApi.deleteUserBlob(userId)

    if (!deleted) {
      res.status(404).json({ ok: false, error: 'User blob not found' })
      return
    }

    res.json({ ok: true })
  } catch (error) {
    console.error('Delete user blob error:', error)
    res.status(500).json({ error: 'Failed to delete user blob' })
  }
})

app.post('/market/quotes', async (req, res) => {
  try {
    const quotes = await marketDataScripts.getAssetQuotes(req.body?.assets, req.body?.refresh)
    res.send(quotes)
  } catch (error) {
    console.error('Market quotes error:', error)

    if (isRequestValidationError(error)) {
      res.status(400).json({ error: error.message })
      return
    }

    res.status(500).json({ error: 'Failed to resolve market quotes' })
  }
})

app.post('/market/risk-indicators', async (req, res) => {
  try {
    const riskIndicators = await marketDataScripts.getAssetRiskIndicators(
      req.body?.assets,
      req.body?.refresh,
      req.body?.riskOverrides,
    )
    res.send(riskIndicators)
  } catch (error) {
    console.error('Market risk indicators error:', error)

    if (isRequestValidationError(error)) {
      res.status(400).json({ error: error.message })
      return
    }

    res.status(500).json({ error: 'Failed to resolve market risk indicators' })
  }
})

const hydratedIsinRiskEntries = loadPersistedIsinRiskCacheIntoRuntime()
const hydratedCryptoRiskEntries = loadPersistedCryptoRiskCacheIntoRuntime()
const hydratedGoldRiskEntries = loadPersistedGoldRiskCacheIntoRuntime()
console.log(`Loaded ${hydratedIsinRiskEntries} shared ISIN risk cache entries`)
console.log(`Loaded ${hydratedCryptoRiskEntries} shared crypto risk cache entries`)
console.log(`Loaded ${hydratedGoldRiskEntries} shared gold risk cache entries`)

app.listen(port, () => {
  console.log(`Personal finance bot listening on port ${port}`)
})

app.use((err, req, res, next) => {
  console.log(err.stack)
  console.error(err.stack)
  next(err)
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

// Assets schema management
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

app.put('/assets/schema', authMiddleware, async (req, res) => {
  const passwordHash = req.userPasswordHash
  const result = await updateAssetsSchema(passwordHash, req.body || {})
  if (!result.ok) {
    res.status(400).send({ ok: false, error: result.error })
    return
  }
  res.send({ ok: true, assetsSchema: result.assetsSchema })
})

// View groups management
app.put('/assets/view-groups', authMiddleware, async (req, res) => {
  const passwordHash = req.userPasswordHash
  const result = await updateViewGroups(passwordHash, req.body || {})
  if (!result.ok) {
    res.status(400).send({ ok: false, error: result.error })
    return
  }
  res.send({ ok: true, assetsSchema: result.assetsSchema })
})

app.put('/assets/risk-overrides', authMiddleware, async (req, res) => {
  const passwordHash = req.userPasswordHash
  const result = await updateRiskOverrides(passwordHash, req.body || {})
  if (!result.ok) {
    res.status(400).send({ ok: false, error: result.error })
    return
  }
  res.send({ ok: true, assetsSchema: result.assetsSchema })
})

// Normalize unknown app URLs back to the login entrypoint.
app.use((req, res, next) => {
  if (isAppRouteRequest(req)) {
    redirectToHome(req, res)
    return
  }

  next()
})
