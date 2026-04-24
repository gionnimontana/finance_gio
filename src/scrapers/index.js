/**
 * Re-export vendor scrapers and shared multi-scraper utilities for portfolio valuation flows.
 */
const etfScraper = require('./vendors/justETFscraper')
const cryptoScraper = require('./vendors/youngPlatformScraper')
const beaconchainScraper = require('./vendors/beaconchainScraper')
const cryptoWalletScraper = require('./vendors/etherScan')
const goldScraper = require('./vendors/goldPriceScraper')
const core = require('./core')

module.exports = {  
    etfScraper,
    cryptoScraper,
    cryptoWalletScraper,
    beaconchainScraper,
    goldScraper,
    multipleScraper: core.multipleUrlSelectorScraper,
}