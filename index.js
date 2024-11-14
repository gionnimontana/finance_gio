require('dotenv').config({path: __dirname + '/.env'})

const portfolioScripts = require('./src/scripts/portfolio')
const beaconchainScraper = require('./src/scrapers/vendors/beaconchainScraper')
const scrapers = require('./src/scrapers')

const main = async () => {

    // await scrapers.cryptoScraper.cryptoValue('BTC')
    
    const portfolio = await portfolioScripts.getPortfolioByAssetClass()
    console.log(portfolio)

    // const beaconchainValue = await beaconchainScraper.validatorAdjustedBalanceScraper('259846')
    // console.log(`The value of the validator is ${beaconchainValue} ETH`)
}

main()