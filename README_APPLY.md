# PCI Earth Intelligence — safe additive release

Baseline: verified GitHub `6c17c42` (Nov 22, 2026). No Events or Module 1 changes.

## Delivered
- Eight accessible scientific categories with no inline TSX styling; existing shared CSS retained.
- Fixed national Pakistan map; category-dependent REAL source overlays (FIRMS, EONET, NASA GIBS, GPM imagery); unavailable scientific analyses never fabricated.
- Deterministic, unit-tested science engine: NASA POWER recent daily solar/rainfall sample mean vs latest (7+ distinct recent days; 10-day freshness), FIRMS sample count.
- Existing proxy expanded for authorized rainfall/solar HISTORY with a strict 8-city allowlist and maximum 30 days.
- Existing diagnostics, source information and disclaimers preserved. No signup, profiles, payments, or new exposed science endpoints.

## Not yet delivered
- NDVI/NDWI, field inspection prioritization, flood extent, surface heat, land-cover history, night lights, crop forecasts. These require new validated raster pipelines and additional sources.
- API signup/auth. The existing NASA satellite public data endpoints stay accessible. Do NOT claim they are protected.
- Province/national-border polygon clipping: bounding rectangle includes neighboring countries; this is disclosed.

## Apply (PowerShell from PCI_Clean)
Extract archive at repository root preserving directories. Do not copy another older patch over it.
Run:
`npm --prefix Module_2_Public_Website test`
`npm --prefix Module_2_Public_Website run build`

If either fails DO NOT COMMIT or PUSH. If both pass:
`git add Module_2_Public_Website/src/components/SatelliteDashboard.tsx Module_2_Public_Website/src/app/api/satellite/route.ts Module_2_Public_Website/src/lib/satelliteScience.mjs Module_2_Public_Website/src/lib/satelliteScience.d.mts Module_2_Public_Website/public/satellite-map.html Module_2_Public_Website/packages/ui/src/styles/satellite.css Module_2_Public_Website/tests/satellite-earth-intelligence.test.mjs`
`git diff --cached --check`
`git commit -m "Add tested PCI satellite science categories and observational comparisons"`
`git push origin main`

Before applying, verify `git rev-parse --short HEAD` returns `6c17c42`. The patch intentionally modifies ONLY Module 2. Deployment to Hostinger is separate and requires review.
