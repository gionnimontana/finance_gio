require('dotenv').config({path: __dirname + '/.env'})
const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const portfolioScripts = require('./src/scripts/portfolio')
const { getHistoricalData, updateHistoricalData } = require('./src/api')

const app = express()
const port = 8085

app.use(cors())
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true}))
app.use(express.static(__dirname)) // Serve static files from root
app.listen(port, () => { console.log(`Personal finance bot listening on port ${port}`)})

app.use((err, req, res, next) => {
  console.log(err.stack)
  console.error(err.stack)
  console.log('@@@@@req:', req)
  console.log('@@@@@res:', res)
  next(err)
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
