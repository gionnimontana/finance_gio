const test = require('node:test')
const assert = require('node:assert/strict')

const justEtfScraper = require('../../server/scrapers/vendors/justETFscraper')

test('extractKidDocumentUrl returns the matching KID PDF for the requested ISIN', () => {
  const html = `
    <table>
      <tr data-testid="etf-documents-panel_item-etf-docs-prp-en">
        <td>
          <a href="https://api.fundinfo.com/document/f1bb925f6b6da69719cb5a9ea65a1b8a_126783/PRP_DE_en_IE00B4L5Y983_YES_2026-04-09.pdf">
            KID (EN)
          </a>
        </td>
      </tr>
    </table>
  `

  assert.equal(
    justEtfScraper.extractKidDocumentUrl(html, 'IE00B4L5Y983'),
    'https://api.fundinfo.com/document/f1bb925f6b6da69719cb5a9ea65a1b8a_126783/PRP_DE_en_IE00B4L5Y983_YES_2026-04-09.pdf'
  )
})

test('extractIssuerProfileUrl returns the external issuer page linked from justETF', () => {
  const html = `
    <div class="issuer-link">
      <a href="https://www.wisdomtree.eu/products/ucits-etfs-unleveraged-etps/cryptocurrency/wisdomtree-physical-bitcoin">
        ETF Profile
      </a>
    </div>
  `

  assert.equal(
    justEtfScraper.extractIssuerProfileUrl(html),
    'https://www.wisdomtree.eu/products/ucits-etfs-unleveraged-etps/cryptocurrency/wisdomtree-physical-bitcoin'
  )
})

test('buildKnownDirectIssuerKidUrl returns the direct WisdomTree KID when the issuer page is blocked', () => {
  assert.equal(
    justEtfScraper.buildKnownDirectIssuerKidUrl(
      'GB00BJYDH287',
      'https://www.wisdomtree.eu/products/ucits-etfs-unleveraged-etps/cryptocurrency/wisdomtree-physical-bitcoin'
    ),
    'https://dataspanapi.wisdomtree.com/pdr/documents/PRIIP_KID/WIXL/GB/EN-GB/GB00BJYDH287/'
  )
})

test('extractKidDocumentUrl accepts issuer-hosted PRIIP KID links that match the ISIN', () => {
  const html = `
    <div id="product-documents">
      <a href="https://dataspanapi.wisdomtree.com/pdr/documents/PRIIP_KID/WIXL/IT/IT-IT/GB00BJYDH287/">
        KID
      </a>
    </div>
  `

  assert.equal(
    justEtfScraper.extractKidDocumentUrl(html, 'GB00BJYDH287'),
    'https://dataspanapi.wisdomtree.com/pdr/documents/PRIIP_KID/WIXL/IT/IT-IT/GB00BJYDH287/'
  )
})

test('extractSyntheticRiskIndicator parses the standard PRIIPs wording', () => {
  const text = `
    Risk Indicator Lower risk Higher risk.
    The summary risk indicator is a guide to the level of risk of this product compared to other products.
    We have classified this product as 4 out of 7, which is a medium risk class.
  `

  assert.equal(justEtfScraper.extractSyntheticRiskIndicator(text), 4)
})

test('extractSyntheticRiskIndicator parses localized PRIIP wording from issuer-hosted KIDs', () => {
  const text = `
    Quali sono i rischi e qual è il potenziale rendimento?
    L'indicatore sintetico di rischio è un'indicazione orientativa del livello di rischio di questo prodotto rispetto ad altri prodotti.
    Abbiamo classificato questo prodotto al livello 6 su 7, che corrisponde alla seconda più alta classe di rischio.
  `

  assert.equal(justEtfScraper.extractSyntheticRiskIndicator(text), 6)
})

test('isinRiskOptionCreator uses an isolated cache key for SRI values', () => {
  const cacheKey = justEtfScraper.buildIsinRiskCacheKey('IE00B4L5Y983')
  const options = justEtfScraper.isinRiskOptionCreator('IE00B4L5Y983')

  assert.deepEqual(Object.keys(options), [cacheKey])
  assert.equal(options[cacheKey].providers[0].name, 'justetf-kid')
  assert.equal(options[cacheKey].cacheTtlMs, 24 * 60 * 60 * 1000)
})
