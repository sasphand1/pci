# PCI Satellite API request limits — backend-only overlay

## Source and scope
Prepared against PCI Satellite V3 Module_1_Adapter (the same source files included in the V3 update). Apply this overlay to the PCI_Clean repository root. No keys are included and no other modules are changed.

## Enforced minimum intervals
- NASA FIRMS: **180 minutes** (8 scheduled requests per 24 hours; each ingestion currently fetches one area CSV for VIIRS_SNPP_NRT, 1-day window).
- NASA POWER, NASA GIBS, Sentinel-1, Sentinel-2, Sentinel-5P: **1440 minutes** (daily).
- NASA EONET, NASA GPM imagery: **360 minutes** (4/day).

Actual interval = max(source's configured refresh_minutes, hard backend minimum). Admin manual Refresh and automated jobs are both rate-limited. The DB claim is atomic and marks attempts before contacting providers, including failures. A refresh pending before its next eligible time is deferred; retrying manual refresh returns HTTP 429 with nextEligibleAt. The 60-second scheduler will process eligible jobs. Provider status response now includes minRefreshMinutes and effectiveRefreshMinutes.

**Limit scope:** enforced for ingestion calls made through these PCI backend routes and scheduler. It cannot govern separate scripts, copies of the backend with an independent database, other NASA applications using the same key, or provider-side billable transaction multipliers.

## Verify locally (PowerShell 5.1)
From PCI_Clean:

```powershell
node --test Module_1_Adapter/tests/satellite-strict-limits.test.mjs
npm --prefix Module_1_Adapter test
npm --prefix Module_1_Adapter run build
```

Only commit/push when tests and build pass; Hostinger must deploy Module 1. Store **the regenerated** NASA_FIRMS_MAP_KEY as Module 1's environment variable. Enable the FIRMS provider with 180 minutes. Existing saved refresh intervals above the minimum remain valid. Do not commit credentials or share key-bearing URLs.

## Provider accuracy limits
This patch changes **request scheduling**, not scientific validation. POWER reports NASA's modeled rainfall and solar estimates. FIRMS detects thermal anomalies rather than confirmed fires. EONET may legitimately return no Pakistan-region events. GIBS/GPM are image layers, not numerical district rainfall. Sentinel outputs are catalogue entries, not flood maps, vegetation indices, or pollution values. Live ingestion and Hostinger data were not verified in this offline build.
