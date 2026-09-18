# Performance Weather Moods

This page is an implementation plan for replacing the dashboard's current rocket/fire performance emojis with a daily/weekly percentage-driven weather forecast and rare-event moods. The forecast will appear both in the dashboard top bar beside the existing ATH percentage mood and in the relevant short-horizon performance surface. Completed refresh groups will also receive their own delta-specific mood.

## Goal

Use the same percentage-to-mood approach as the shared `getAthMood()` helper, but communicate the severity of short-horizon performance changes more intuitively:

- Positive performance moves from sunshine through a rainbow to an exceptionally rare unicorn.
- Negative performance moves through increasingly severe storms, ending with an explosion and a worst-case skull.
- The mood must be derived from the percentage change, not only from whether the absolute delta is positive or negative.
- The compact scale applies to daily or weekly movement, not aggregate year-to-date or monthly percentage changes.
- The top bar must show the short-horizon weather mood alongside, rather than in place of, the existing ATH percentage mood.
- Each completed `progress_group_summary` must communicate the severity of that group's refresh delta without changing its existing absolute delta or percentage text.

## Portfolio Performance Mood Bands

The bands are deliberately concentrated around `0%`: movements within `-0.25%` to `0.25%` are stable, while the common daily/weekly changes up to `1%` receive a meaningful weather signal. The following matrix is the concrete starting point:

| Percentage change | Icon | Meaning |
| --- | --- | --- |
| `<= -10%` | `☠️` | Worst outcome; extraordinary short-horizon decline |
| `> -10%` and `<= -5%` | `💥` | Catastrophic loss; outside the normal weather range |
| `> -5%` and `<= -2%` | `🌪️` | Extreme storm; unusually severe loss |
| `> -2%` and `<= -1%` | `⛈️` | Heavy storm; large loss |
| `> -1%` and `< -0.25%` | `🌧️` | Rain; meaningful loss |
| `>= -0.25%` and `<= 0.25%` | `🌤️` | Mostly stable or near-neutral movement |
| `> 0.25%` and `< 1%` | `☀️` | Positive movement with clear sunshine |
| `>= 1%` and `< 4%` | `🌞` | Strong gain; bright sunshine |
| `>= 4%` and `< 10%` | `🌈` | Rare surge; outside the usual daily/weekly range |
| `>= 10%` | `🦄` | Best outcome; exceptional short-horizon gain |

The boundary comparisons must remain explicit so a value exactly at a threshold has one deterministic mood. The helper must use the unrounded percentage; display rounding must not move a value across a mood boundary.

Every portfolio-level weather instance must use one canonical daily or weekly percentage and its matching baseline. That includes the short-horizon overview, the top-bar weather icon, and the streamed portfolio-progress delta; these surfaces must not calculate subtly different percentages from the same refresh.

## Progress Group Delta Mood Bands

Completed group summaries already receive a `diffPct` from `getProgressDiffMeta(currentGroupTotal, previousGroupTotal)`. Classify that unrounded percentage, not the raw currency delta: a `EUR 100` movement does not have the same severity for every group size. The visible absolute delta and rounded percentage remain unchanged.

The group bands deliberately start with the same thresholds as the portfolio weather bands so the severity language is consistent, but they are a separate product contract and helper because their source is a refresh-to-refresh group delta rather than the canonical portfolio daily/weekly value.

| Group delta percentage | Icon | Accessible meaning |
| --- | --- | --- |
| `<= -10%` | `☠️` | Group delta down at least 10 percent |
| `> -10%` and `<= -5%` | `💥` | Group delta down between 5 and 10 percent |
| `> -5%` and `<= -2%` | `🌪️` | Group delta down between 2 and 5 percent |
| `> -2%` and `<= -1%` | `⛈️` | Group delta down between 1 and 2 percent |
| `> -1%` and `< -0.25%` | `🌧️` | Group delta down between 0.25 and 1 percent |
| `>= -0.25%` and `<= 0.25%` | `🌤️` | Group delta is within 0.25 percent of unchanged |
| `> 0.25%` and `< 1%` | `☀️` | Group delta up between 0.25 and 1 percent |
| `>= 1%` and `< 4%` | `🌞` | Group delta up between 1 and 4 percent |
| `>= 4%` and `< 10%` | `🌈` | Group delta up between 4 and 10 percent |
| `>= 10%` | `🦄` | Group delta up at least 10 percent |

When a group has no finite previous total, or its previous total is zero, the summary must keep the existing `—` placeholder and omit the mood. Missing data is not a near-neutral move.

## Top-Bar Contract

The dashboard title currently contains the ATH mood as plain text. Make the title a composed surface with stable child spans: the base title, the existing ATH mood, and a new short-horizon performance mood. The new weather span belongs immediately beside the ATH span, uses `role="img"` and its helper-provided `aria-label`, and remains independently addressable for tests.

Use one title renderer backed by explicit ATH and short-horizon mood state. `renderAthDistance()` must only update the ATH state, and the short-horizon render path must only update its own state; neither render may overwrite the other's icon while cached data, live data, or asynchronous risk data arrives.

## Implementation Plan

1. Add `getPerformanceWeatherMood(percentage)` beside `getAthMood()` in `view/commons/utils.js`. It must return `{ icon, label }`, compare the unrounded finite percentage against the portfolio bands above, and return an explicitly labelled neutral weather result for non-finite portfolio input.
2. Add `getProgressGroupDeltaMood(percentage)` beside it. Keep its threshold table separate from the portfolio helper even though version one matches it, return `{ icon, label }` for a finite group `diffPct`, and return `null` for unavailable group-baseline input.
3. Expose both helpers on `window` alongside `window.getAthMood` so dashboard scripts and deterministic browser tests can use the shared contracts without duplicating thresholds.
4. Establish one explicit daily or weekly portfolio baseline before rendering any weather mood. Carry its current total, prior total, horizon label, and unrounded percentage through the normal dashboard payload/state and the refresh-stream completion path.
   - Do not derive this value from the year-to-date `#delta_value` or previous-month `#prevMonth_delta_value` fields.
   - Do not treat `currentPortfolioTotal` and `prevMonthTotal` from the SSE event as a short-horizon pair; they represent a monthly baseline.
   - Add or select an overview row for the chosen daily or weekly horizon. Remove the sign-only `🚀` and `🔥` indicators from the year-to-date and previous-month rows while retaining their absolute values, percentages, and positive/negative classes.
5. Reshape `#dashboard_title` in `view/dashboard/index.html` into stable base-title, ATH-mood, and performance-mood spans. Replace the current text-only `setDashboardTitle()` behavior with a composed renderer so the new weather icon appears beside the ATH percentage mood and neither render path erases the other.
   - Render both mood spans with `role="img"` and their distinct `aria-label` values.
   - Render the neutral short-horizon result when no usable portfolio baseline is available; it must say that performance data is unavailable rather than imply a real flat move.
6. Replace the streamed progress-delta emoji in `updateProgress()` with the canonical short-horizon portfolio weather mood.
   - Prefer the valid matching daily/weekly percentage over a percentage derived from the current asset or monthly totals.
   - Fall back to the running delta sign only when no valid percentage baseline exists.
   - Keep the existing absolute delta, percentage label, positive/negative class, and progress persistence behavior unchanged.
7. Extend `renderCompletedProgressAssets()` so every valid `progress_group_summary` appends a `progress_group_mood` span after its existing `progress_group_diff` content.
   - Feed `groupDiffMeta.diffPct` to `getProgressGroupDeltaMood()` without rounding it first.
   - Give the mood span `role="img"`, its group-delta `aria-label`, and a stable group-scoped test id or selector.
   - Leave the existing `—` output untouched and render no icon when `groupDiffMeta` is unavailable.
8. Add compact layout styling so group names, the existing numeric summary, and the new fixed-size mood span remain readable on narrow screens. Preserve the existing progress-banner state serialization; completed-banner HTML must retain the new accessible mood markup when restored.

## Test Plan

Extend `tests/e2e/specs/dashboard.spec.js` with deterministic seeded daily/weekly cases for:

- Near-neutral movement such as `-0.1%`, confirming `🌤️`.
- A modest loss such as `-0.5%`, confirming `🌧️`.
- Escalating losses such as `-1.5%`, `-3%`, `-6%`, and `-11%`, confirming `⛈️`, `🌪️`, `💥`, and `☠️` respectively.
- Escalating gains such as `0.5%`, `1.5%`, `6%`, and `11%`, confirming `☀️`, `🌞`, `🌈`, and `🦄` respectively.
- Exact-boundary cases at `-10%`, `-5%`, `-2%`, `-1%`, `-0.25%`, `0.25%`, `1%`, `4%`, and `10%`.
- A streamed progress update, confirming it uses the calculated daily/weekly portfolio percentage rather than only the sign of `runningDelta`.
- A top-bar assertion that the weather mood and the existing ATH mood render together, retain separate accessible labels, and remain present after the normal cached-to-live render sequence.
- Completed grouped-refresh cases covering each group-delta mood band, including exact boundaries. Assert the existing `.progress_group_diff .abs_value` and percentage remain intact, then assert the adjacent `progress_group_mood` icon and accessible label.
- A no-baseline and zero-baseline group case, confirming the summary remains `—` without a neutral mood.
- Accessible labels for every rendered mood span.

The existing refresh-progress assertions around `#progress_delta` should retain their absolute-value checks and add an icon/label assertion. Interior-band test data should sit clear of the thresholds, while separate exact-boundary tests prove the deterministic comparisons. Browser-level helper checks may exercise every band directly through the exported helpers, while grouped refresh fixtures should cover representative completed-banner rendering and restoration behavior.

## Documentation Maintenance

After implementation:

- Update `view/dashboard/index.md` to mention percentage-driven weather, the composed top-bar moods, and grouped refresh-delta moods.
- Update `docs/portfolio-metrics.md` with the chosen canonical daily/weekly baseline and both durable threshold contracts, because the title and progress components now share them.
- Add a dated entry to `docs/log.md` when the behavior is implemented and the plan becomes current behavior.

## Validation

Run the narrow dashboard tests first, then the complete e2e suite if they pass:

```bash
nvm use 24.15.0
npm run test:e2e -- --grep "dashboard"
npm run test:e2e
```

Finally, search the frontend for `🚀` and `🔥` to confirm the old performance indicators are no longer used, while leaving unrelated loading or navigation emojis unchanged.

## Related

- [../view/commons/utils.js](../view/commons/utils.js)
- [../view/dashboard/script.js](../view/dashboard/script.js)
- [../view/dashboard/index.md](../view/dashboard/index.md)
- [./portfolio-metrics.md](./portfolio-metrics.md)
