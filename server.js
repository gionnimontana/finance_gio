require('dotenv').config({path: __dirname + '/.env'})
const express = require('express')
const cors = require('cors')
const bodyParser = require('body-parser')
const portfolioScripts = require('./src/scripts/portfolio')

const app = express()
const port = 8085

app.use(cors())
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true}))
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
  res.send(portfolio)
})