require('dotenv').config({path: __dirname + '/.env'})
const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const portfolioScripts = require('./src/scripts/portfolio')
const { getHistoricalData, updateHistoricalData, getAssetsSchema, updateAssetsSchema, updateViewGroups } = require('./src/api')
const { handleGenerate, handleValidate, authMiddleware, hashPassword, userExists } = require('./src/auth')

const app = express()
const port = 8085

app.use(cors())
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true}))
app.use(express.static(__dirname + '/view')) // Serve static files from view folder

// Legacy base-path support: redirect /financegio/* to root
app.use('/financegio', (req, res) => {
  const target = req.originalUrl.replace(/^\/financegio/, '') || '/'
  res.redirect(301, target)
})

// Auth routes (no authentication required)
app.post('/auth/generate', handleGenerate)
app.post('/auth/validate', handleValidate)

// Redirect old URLs to new folder structure
app.get('/dashboard.html', (req, res) => res.redirect('/dashboard/'))
app.get('/assets.html', (req, res) => res.redirect('/assets/'))
app.get('/history.html', (req, res) => res.redirect('/history/'))

// Default route redirects to login (which will redirect to dashboard if authenticated)
app.get('/', (req, res) => res.redirect('/login/'))

app.listen(port, () => { console.log(`Personal finance bot listening on port ${port}`)})

app.use((err, req, res, next) => {
  console.log(err.stack)
  console.error(err.stack)
  console.log('@@@@@req:', req)
  console.log('@@@@@res:', res)
  next(err)
})

// SSE endpoint for streaming portfolio refresh (requires auth via query param for SSE)
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
    await portfolioScripts.streamPortfolio(passwordHash, sendEvent)
  } catch (error) {
    console.error('Stream portfolio error:', error)
    sendEvent('error', { message: error.message })
  }

  res.end()
})

// add support for refresh url param
app.get('/portfolio', authMiddleware, async (req, res) => {
  const params = req.query
  const refresh = params.refresh
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
  res.send(schema)
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
