const u = require('./utils')

/**
 * Create the params for the isinValueScraper
 * @param {'BTC' | 'ETH' } crypto - The crypto currency to scrape
 * @returns {Object} - The params for the isinValueScraper
 * @throws {Error} - If the value is not found or not a number or 0
*/
const cryptoOptionsCreator = (crypto) => {
    const url = `https://www.xe.com/currencycharts/?from=${crypto}&to=EUR`
    const logger = (msg) => console.log(`cryptoValueScraper - ${msg}`)
    const selector = 'p.sc-b39d611a-0.hjhFZZ[style="font-weight: 600; margin: 0px 8px;"]'
    const selectorFunction = (selector) => {
        const rawValue = document.querySelector(selector).innerText
        const match = rawValue.match(/\d{1,3}(?:,\d{3})*(?:\.\d+)?(?=\sEUR)/);
        if (!match) throw new Error('Value not found');
        const numbericValue = parseFloat(match[0].replace(/,/g, ''));
        if (!numbericValue) throw new Error('Value not found');
        return numbericValue;
    }
    return {
        [crypto]: { url, selector, selectorFunction, logger }
    }
}

/**
 * Scrape the value of a crypto currency
 * @param {'BTC' | 'ETH' } crypto - The crypto currency to scrape
 * @returns {Promise<number>} - The value of the crypto currency
 * @throws {Error} - If the value is not found or not a number or 0
*/
const cryptoValue = async (crypto) => {
    const params = cryptoOptionsCreator(crypto)
    const { url, selector, selectorFunction, logger } = params[crypto]
    return u.urlSelectorScraper(url, selector, selectorFunction, logger)
}

module.exports = {
    cryptoValue: cryptoValue,
    cryptoOptionsCreator,
}