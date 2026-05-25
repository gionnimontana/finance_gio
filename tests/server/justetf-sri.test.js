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

test('extractSyntheticRiskIndicator parses the standard PRIIPs wording', () => {
  const text = `
    Risk Indicator Lower risk Higher risk.
    The summary risk indicator is a guide to the level of risk of this product compared to other products.
    We have classified this product as 4 out of 7, which is a medium risk class.
  `

  assert.equal(justEtfScraper.extractSyntheticRiskIndicator(text), 4)
})

test('isinRiskOptionCreator uses an isolated cache key for SRI values', () => {
  const cacheKey = justEtfScraper.buildIsinRiskCacheKey('IE00B4L5Y983')
  const options = justEtfScraper.isinRiskOptionCreator('IE00B4L5Y983')

  assert.deepEqual(Object.keys(options), [cacheKey])
  assert.equal(options[cacheKey].providers[0].name, 'justetf-kid')
  assert.equal(options[cacheKey].cacheTtlMs, 24 * 60 * 60 * 1000)
})
