# PCI Satellite Intelligence V3 — Hostinger root overlay

## Scope and truth in advertising

Existing PCI Modules 1 (Express/TypeScript), 2 (Next.js), 3 (Admin Panel) are reused. No new server, no new database, and no modifications to the Events or creator-ranking modules.

The management page `Module_3_Admin_Panel/src/app/satellite/page.tsx` dynamically renders the provider rows returned by `/api/v1/admin/satellite/providers`. Consequently, adding provider catalogue entries in Module 1 and migration 098 automatically creates Owner-controlled enable/disable, refresh interval, health, error, and refresh controls for each new provider. **Do not replace the admin page.** Existing server-side Owner authorization, CSRF rules, audit logging, quota controls and static upstream allowlists remain active.

### Provider-to-management mapping

| ID | Management label | Source | Usable result / scientific limitation | Credential |
|---|---|---|---|---|
| power | NASA POWER | NASA POWER daily point API | Rainfall and solar daily city estimates, not GPM | None |
| firms | NASA FIRMS (VIIRS) | NASA FIRMS area CSV | Thermal anomaly detections, not confirmed fires | `NASA_FIRMS_MAP_KEY` in Module 1 Hostinger environment |
| eonet | NASA EONET | EONET v3 Events API | Curated natural event **point metadata** within regional bounding box | None |
| gibs | NASA GIBS | GIBS MODIS Terra true-colour raster | Satellite **image map** (no derived metric) | None |
| gpm | NASA GPM IMERG | NASA GIBS IMERG Precipitation Rate WMS | Visualized precipitation-rate **image map**, NOT numeric rainfall or district aggregation | None for visualization |
| sentinel1 | Copernicus Sentinel-1 | CDSE OData Products catalogue | Scene metadata; **no calculated flood extent** | None for catalogue; credentials required for science product downloads |
| sentinel2 | Copernicus Sentinel-2 | CDSE OData Products catalogue | Scene metadata; **no calculated NDVI/crop health** | None for catalogue; credentials required for processing |
| sentinel5p | Copernicus Sentinel-5P | CDSE OData Products catalogue | Scene metadata; **no calculated NO₂/PM2.5/AQI** | None for catalogue; credentials required for processing |

Existing GPM/Sentinel placeholders are upgraded to operational *image/catalogue-only* adapters. This is **not** a claim that high-resolution analytic products exist. Implementing scientifically validated numeric IMERG, SAR flood extent, optical NDVI and tropospheric column metrics is a separate production capability requiring suitable processing, uncertainty controls, product selection and verification.

### First activation

Migration `098_satellite_feeds.sql` adds the two new providers and sets all *previously unimplemented, never-attempted* GPM/Sentinel placeholders to enabled **once**. A `satellite.rollout_flags` row prevents an API restart from silently overriding later manual disable choices. FIRMS is not enabled without a credential. New NASA and Copernicus no-key sources queue their first ingestion automatically. The existing worker must be running (`RUN_WORKER_IN_API=true` if there is no standalone Module 1 worker).

`ensureSatelliteSchema()` runs migrations 096 then 098. Migrator can also apply 098 by filename. Runtime SQL checks existing constraints and flags; no creator / Events tables change.

### Public read-only endpoints

Existing `/api/v1/satellite/sources`, `/fires/latest`, `/rainfall/latest`, `/solar/latest`, and their history routes remain.

- `/api/v1/satellite/natural-events/latest`
- `/api/v1/satellite/scenes/latest?mission=sentinel1|sentinel2|sentinel5p`
- `/api/v1/satellite/imagery/latest`
- `/api/v1/satellite/gpm/imagery/latest`

The Next.js same-origin `/api/satellite?metric=...` proxy has explicit selectors for these additions. MapLibre GL JS + OpenFreeMap (already used by Events) is reused on `/satellite` through its own isolated map instance. The new map has toggles for NASA GIBS true colour and GPM precipitation visualization; EONET markers are distinct from FIRMS hotspots.

### Data honesty, robustness, and security

- No invented records, values, warnings, health scores, crop conditions, flood extent or pollutant concentrations.
- Fixed allowlisted NASA/Copernicus hosts; no arbitrary external URLs or user-supplied upstream API keys.
- Upstream 20-second timeout for JSON, 12-second timeout per image check, 8 MB bounded text responses and 600 KB bounded raster checks.
- Deterministic parsing and geographic bounding rectangle `[60,23,78,38]`. It is **not** an authoritative Pakistan boundary and may include nearby territories.
- PostgreSQL batch inserts (200 observations max), compound unique keys, Redis epoch invalidation, independent satellite rate limit and fail-closed Redis outage policy.
- No Events scheduler, Events map, creator or ranking files are modified by this overlay.
- A successful catalogue search with zero Pakistani results is a valid empty state, not fabricated evidence that an event occurred.

### Operational runbook

1. Back up the PCI repository and database before deployment.
2. Extract ZIP into **PCI_Clean root**; ensure folders start with `Module_1_Adapter/` and `Module_2_Public_Website/`.
3. Run `npm --prefix Module_1_Adapter test` and `npm --prefix Module_1_Adapter run build`.
4. Run `npm --prefix Module_2_Public_Website test` and `npm --prefix Module_2_Public_Website run build`.
5. Run `npm --prefix Module_3_Admin_Panel test` and `npm --prefix Module_3_Admin_Panel run build`.
6. Inspect `git status`, verify only intended changes are staged, and push to `main` after all builds pass.
7. Confirm GitHub Actions is green and that Hostinger deployed the new Module 1 + Module 2 revisions.
8. In PCI Management → Satellite APIs, press **Reload**. Verify all eight source rows and record the latest attempt/success/error. New no-key sources auto-queue once from migration. Manually refresh an enabled source if necessary.
9. Open `/satellite`: check rainfall/solar numeric values (POWER), regional EONET and Copernicus data lists, and the two imagery toggles. A lack of regional EONET events or a satellite acquisition is a legitimate empty result.
10. For FIRMS, get the free MAP_KEY at https://firms.modaps.eosdis.nasa.gov/api/map_key/ and set it **only** in Module 1 environment; enable and refresh in Admin.

**Live limitations:** Public NASA/Copernicus availability, rate quotas, Hostinger migrations/worker execution and real production build cannot be certified from the inspection ZIP alone. New adapters have deterministic fixture tests; the user must verify live provider responses after deployment. To roll back safely, disable providers in Admin and revert the code commit; additive database tables need not be dropped.

Official documentation:
- https://eonet.gsfc.nasa.gov/docs/v3
- https://nasa-gibs.github.io/gibs-api-docs/
- https://gibs.earthdata.nasa.gov/layer-metadata/v1.0/IMERG_Precipitation_Rate.json
- https://documentation.dataspace.copernicus.eu/APIs/OData.html
