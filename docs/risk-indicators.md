# Risk Indicators

The 1-7 risk badges shown on dashboard assets, where each value comes from, and how it relates to the regulatory PRIIPs summary risk indicator.

## Current State
- `GET /assets/risk-indicators?refresh=<bool>` returns `{ values: { [assetId]: { value, label } }, failures: [assetId] }` for the current user's schema. The legacy `GET /assets/isin-risk` returns only the ISIN slice as plain numbers.
- Each family is resolved independently and merged:

| Asset class | Label | Source |
| --- | --- | --- |
| `Isin` | `SRI` | Parsed from the product's PRIIPs KID PDF (justETF-linked, issuer-hosted, or direct WisdomTree fallback). |
| `Crypto` | `Risk` | Computed from Yahoo Finance daily closes for `<ticker>-EUR`. |
| `Gold` | `Risk` | Computed from Yahoo Finance `GC=F` gold-futures closes. |
| `Other` | `Risk` | Default `1`, replaced by a per-user integer override from `assetsSchema.riskOverrides`. |

- Scraped families use one retry and share the scraper runtime cache, with 24-hour fresh entries persisted to the shared cache files described in [shared-risk-caches.md](./shared-risk-caches.md).
- The dashboard loads risk values in the background after the portfolio renders. It shows a badge per asset, a weighted average per group, and a weighted average for the whole portfolio. Weights are each asset's current `total`; assets with no risk value or a non-positive total are skipped, and averages show one decimal. Risk failures appear in the shared error banner.

## Computed Scores Versus PRIIPs SRI
- The PRIIPs SRI for ISIN assets is regulatory. Under Commission Delegated Regulation (EU) 2017/653, Annex II, the market risk measure (MRM) is the annualised volatility equivalent to a 97.5% value-at-risk over the recommended holding period. Category 2 products compute it from up to 5 years of log returns (at least 2 years of daily data) with a Cornish-Fisher expansion. The SRI then combines the MRM class (1-7) with a credit risk measure (1-6), and manufacturers only move to a new MRM class after it has held for most reference points over the preceding four months.
- The computed crypto/gold `Risk` is a project-specific heuristic: simple daily returns over the last 90 closes annualized with $\sqrt{365}$, plus max drawdown over the last year, each bucketed with fixed thresholds and the higher bucket kept. It has no holding period, no Cornish-Fisher correction, no credit component, and no smoothing, so it reacts to recent moves much faster than an SRI. Thresholds live in [scraper-runtime.md](./scraper-runtime.md).
- Treat SRI and computed `Risk` as comparable in direction only; the weighted portfolio average mixes both scales.

## Notes
- Yahoo Finance's chart API and justETF's quote endpoint are undocumented public endpoints with no published contract; they can change, rate-limit, or block without notice, which is why each has fallbacks or cache reuse.
- `GC=F` is the CME Group COMEX gold futures contract, quoted in USD. The gold score therefore ignores EUR/USD moves and, because futures only trade on exchange days, $\sqrt{365}$ overstates its annualized volatility.

## Sources
- [Commission Delegated Regulation (EU) 2017/653, Annex II](https://www.legislation.gov.uk/eur/2017/653/annex/II/2020-12-31) (point-in-time copy of the EU text as of 31 December 2020; check EUR-Lex for the current consolidated EU version).
- [CME Group gold futures contract specs](https://www.cmegroup.com/markets/metals/precious/gold.contractSpecs.html)

## Related
- [../server/scripts/index.md](../server/scripts/index.md)
- [../server/scrapers/vendors/index.md](../server/scrapers/vendors/index.md)
- [../view/dashboard/index.md](../view/dashboard/index.md)
- [./data-model.md](./data-model.md): `riskOverrides` persistence
