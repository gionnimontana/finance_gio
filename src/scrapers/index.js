const etfScraper = require('./vendors/justETFscraper')
const cryptoScraper = require('./vendors/xeScraper')
const beaconchainScraper = require('./vendors/beaconchainScraper')
const core = require('./core')

module.exports = {  
    etfScraper,
    cryptoScraper,
    beaconchainScraper,
    multipleScraper: core.multipleUrlSelectorScraper,
}