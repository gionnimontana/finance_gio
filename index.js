require('dotenv').config({path: __dirname + '/.env'})

const portfolioScripts = require('./src/scripts/portfolio')
const beaconchainScraper = require('./src/scrapers/vendors/beaconchainScraper')
const scrapers = require('./src/scrapers')

const main = async () => {

    await scrapers.cryptoScraper.cryptoValue('ETH')
    
    // const portfolio = await portfolioScripts.getPortfolio()
    // console.log(JSON.stringify(portfolio))

    // await scrapers.etfScraper.isinValue('LU1829221024')

    // const beaconchainValue = await beaconchainScraper.validatorAdjustedBalanceScraper('259846')
    // console.log(`The value of the validator is ${beaconchainValue} ETH`)
}

main()