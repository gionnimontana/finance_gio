const etfScraper = require('./vendors/justETFscraper')
const cryptoScraper = require('./vendors/youngPlatformScraper')
const beaconchainScraper = require('./vendors/beaconchainScraper')
const cryptoWalletScraper = require('./vendors/etherScan')
const core = require('./core')

module.exports = {  
    etfScraper,
    cryptoScraper,
    cryptoWalletScraper,
    beaconchainScraper,
    multipleScraper: core.multipleUrlSelectorScraper,
}