# Pakistan Creator Index — Ranking Mathematics and Disclosure

**Version:** experimental cross-platform prototype, 2026-11-18. **Not a scientifically validated universal influence measurement.** This document describes implemented algorithms and their limits; it is not approval to publish custom YouTube-derived composite scores.

## 1. Current public YouTube rankings (original engine)

Separate descending rankings by **reported** YouTube channel view count, subscriber count, and published video count. BigInt-safe comparison avoids floating-point overflow. Unavailable observations are not converted to zero. Counts are not unique people, and subscriber counts may be rounded. An exact metric tie shares its rank; stable name/id ordering is solely for repeatable presentation. Original raw-metric rankings remain intact.

## 2. Instagram ranking (existing extension)

Sort approved, enabled public professional Instagram creators by `followers_count` or `media_count`. Counts are separately reported by Meta. Exact count ties share dense ranks. Missing counts are unranked. Instagram counts are not treated as equivalent to YouTube counts.

## 3. Unified Top 10 — proposed normalized rank aggregation

### Eligible cohort

Administrator curates **at most 20** Instagram creators linked to distinct YouTube creators representing the *same person*. Only approved, enabled, linked people with nonmissing, nonnegative integer YouTube subscribers, YouTube lifetime channel views, and Instagram followers are included. No fabricated zeros or inferred identity matching. The cohort and scores change when curated membership changes.

### Competition ranking per dimension

For person `i`, dimension `m`, eligible cohort `N`:

`r_(i,m) = 1 + count{j: x_(j,m) > x_(i,m)}`.

Equal counts have the same competition rank. Normalized standing is:

`P_(i,m) = (N - r_(i,m)) / (N - 1)` for `N > 1`; `P = 1` when `N = 1`.

The latter is a presentation convention and cannot establish comparative superiority for a single candidate.

### Score with two platforms

`Y_i = (P_(i,YT_subscribers) + P_(i,YT_views)) / 2`

`PCI_i = 100 * (0.5 * Y_i + 0.5 * P_(i,IG_followers))`

Equivalent weights: YouTube subscribers 25%, YouTube views 25%, Instagram followers 50%.

**These weights are an editorial modeling choice**, not an established scientific truth or an IMDb formula. The algorithm uses normalized within-cohort competition ranks (a Borda-style rank aggregation), not a measured causal effect or audience quality. It does **not** measure unique audience reach, conversion, trust, or true influence. Exact fractional arithmetic is used for ordering and tie detection; scores displayed to 2 decimals may look equal even if mathematically different. A tie is declared **only when the exact underlying rational score is equal**.

### Shared rank and wheel cards

All people with exactly the same score share one rank and one wheel card. If rank #1 is shared, that card displays a visually split crown and links separately to each person's profile. Ties at ranks other than #1 are also visibly labeled. The UI shows up to ten **distinct score-rank groups**; ten groups can contain more than ten individuals when tied. Never break exact ties by alphabetical ordering for rank assignment (a deterministic identifier order may order people *within* a tied card).

### Third platform (future TikTok)

**Not yet implemented.** Future platform adapters require approved, comparable metric definitions and agreed weights. The two-platform equation MUST NOT silently change when TikTok is enabled; a future versioned policy and admin preview are required.

## 4. IMDb-style Bayesian average (research helper, NOT creator counts)

`BayesianMean = (n * R + m * C)/(n + m)` where `R` is observed mean of real user rating votes, `n` is rating count, `C` is prior/population mean and `m > 0` is equivalent prior sample size. Use only with appropriate first-party star ratings and transparent prior selection. This method is **not** applied to platform follower/view counts.

## 5. Wilson score lower bound (research helper, NOT likes/views)

For `p = positives/n`, confidence parameter `z`, `n > 0`:

`WilsonLower = [p + z²/(2n) - z*sqrt(p(1-p)/n + z²/(4n²))]/[1 + z²/n]`.

The implementation defaults to `z ≈ 1.96` and returns zero for `n = 0`. Valid use requires genuinely independent binary observations. YouTube likes versus views do not meet that interpretation; do **not** use them as positive/negative votes.

## 6. Transparency, governance and permission gates

- Public unified ranking endpoint returns 403 unless `CROSS_PLATFORM_PUBLIC_ENABLED=true`; default is `false`. Keep it disabled pending YouTube API policy evaluation and appropriate permissions.
- Admin can preview cohort and detailed score breakdown without publishing the composite.
- Public UI falls back to the original YouTube raw-metric wheel while unified data is disabled or unavailable.
- Individual platform Top 10 rows remain separate. They are based on raw reported platform metrics.
- Database migration `004_cross_platform_curated.sql` adds explicit curation, checks and a one-human constraint; it must be run after migrations 001–003.
- Source timestamps and coverage must be shown honestly; do not claim comprehensive Pakistan-wide representation from a small curated collection.

## 7. Known limitations

- A 20-person curated sample cannot support broad population-level claims.
- Rank aggregation is unstable when the cohort changes and obscures the original magnitude of differences.
- Requiring matching accounts excludes Instagram-only and YouTube-only people from the unified wheel. This is deliberate for now to avoid unfair missing-data substitution.
- The separate cross-platform engine is **experimental**. Displaying a creator crown in a comparative leaderboard may require a further YouTube policy review.
