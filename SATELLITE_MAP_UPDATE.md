# PCI Satellite Map Overlay — 2026-11-22

## Scope
Three files, overlay from PCI repository root. No modifications to Events page, events radar, Events APIs, or Module 1/3.

- `Module_2_Public_Website/src/components/SatelliteDashboard.tsx`: replaces SVG coordinate grid with same-origin map iframe; posts bounded, validated fire locations.
- `Module_2_Public_Website/public/satellite-map.html`: separate MapLibre GL JS 5.21.0 and OpenFreeMap dark style, matching the Events map engine and basemap style.
- `Module_2_Public_Website/packages/ui/src/styles/satellite.css`: scoped iframe styling.

## Important
This update does NOT populate NASA observations. In `096_satellite.sql`, all sources are `enabled=false` by default. The Owner must enable NASA POWER in the management panel and queue a refresh. NASA FIRMS requires `NASA_FIRMS_MAP_KEY` in the Module 1 Hostinger runtime environment before enabling. A running worker/scheduler is necessary (`RUN_WORKER_IN_API=true` if the scheduler is embedded; otherwise the existing standalone worker must run). After ingestion, check provider last-success and error in the admin Satellite page.

NASA GPM and Sentinel providers are not yet implemented. Rainfall currently is NASA POWER (not GPM). This map uses a bounding rectangle, not a Pakistan-boundary clip. No hazards or alerts are implied.

## Validation
Run `npm --prefix Module_2_Public_Website run typecheck`, `npm --prefix Module_2_Public_Website test`, and `npm --prefix Module_2_Public_Website run build` from PCI root. Visual map/browser checks require Internet access to the same third-party MapLibre CDN and OpenFreeMap style already used by the Events map. Production deploy should occur only after checks pass.
