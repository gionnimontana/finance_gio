require('dotenv').config({path: __dirname + '/.env'})
const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const portfolioScripts = require('./src/scripts/portfolio')
const { getHistoricalData, updateHistoricalData, getAssetsSchema, updateAssetsSchema, updateViewGroups } = require('./src/api')

const app = express()
const port = 8085

app.use(cors())
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true}))
app.use(express.static(__dirname + '/view')) // Serve static files from view folder
app.listen(port, () => { console.log(`Personal finance bot listening on port ${port}`)})

app.use((err, req, res, next) => {
  console.log(err.stack)
  console.error(err.stack)
  console.log('@@@@@req:', req)
  console.log('@@@@@res:', res)
  next(err)
})

// SSE endpoint for streaming portfolio refresh
app.get('/portfolio/stream', async (req, res) => {
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
    await portfolioScripts.streamPortfolio(sendEvent)
  } catch (error) {
    console.error('Stream portfolio error:', error)
    sendEvent('error', { message: error.message })
  }

  res.end()
})

// add support for refresh url param
app.get('/portfolio', async (req, res) => {
  const params = req.query
  const refresh = params.refresh
  const portfolio = await portfolioScripts.getPortfolio(refresh)
  
  // Update historical data with current month values when refresh is triggered
  if (refresh) {
    await updateHistoricalData(portfolio)
  }
  
  res.send(portfolio)
})

app.get('/portfolio/history', async (req, res) => {
  const history = await getHistoricalData()
  res.send(history)
})

// Assets schema management
app.get('/assets/schema', async (req, res) => {
  const schema = await getAssetsSchema()
  res.send(schema)
})

app.put('/assets/schema', async (req, res) => {
  const result = await updateAssetsSchema(req.body || {})
  if (!result.ok) {
    res.status(400).send({ ok: false, error: result.error })
    return
  }
  res.send({ ok: true, assetsSchema: result.assetsSchema })
})

// View groups management
app.put('/assets/view-groups', async (req, res) => {
  const result = await updateViewGroups(req.body || {})
  if (!result.ok) {
    res.status(400).send({ ok: false, error: result.error })
    return
  }
  res.send({ ok: true, assetsSchema: result.assetsSchema })
})
