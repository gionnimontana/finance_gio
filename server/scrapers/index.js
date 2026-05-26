/**
 * Re-export vendor scrapers and shared multi-scraper utilities for portfolio valuation flows.
 */
const etfScraper = require('./vendors/justETFscraper')
const cryptoScraper = require('./vendors/youngPlatformScraper')
const cryptoRiskScraper = require('./vendors/cryptoRiskScraper')
const beaconchainScraper = require('./vendors/beaconchainScraper')
const cryptoWalletScraper = require('./vendors/etherScan')
const goldScraper = require('./vendors/goldPriceScraper')
const goldRiskScraper = require('./vendors/goldRiskScraper')
const core = require('./core')

module.exports = {  
    etfScraper,
    cryptoScraper,
    cryptoRiskScraper,
    cryptoWalletScraper,
    beaconchainScraper,
    goldScraper,
    goldRiskScraper,
    multipleScraper: core.multipleUrlSelectorScraper,
}
