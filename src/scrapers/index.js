const etfScraper = require('./justETFscraper')
const cryptoScraper = require('./xeScraper')
const beaconchainScraper = require('./beaconchainScraper')
const scraperUtils = require('./utils')

module.exports = {  
    etfScraper,
    cryptoScraper,
    beaconchainScraper,
    multipleScraper: scraperUtils.multipleUrlSelectorScraper,
}