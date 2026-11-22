# PCI FIRMS three-sensor data coverage and empty-state fix

## Included
- Module 1 `service.ts`: fetch NOAA-20, NOAA-21 and S-NPP NRT VIIRS datasets for the most recent **3 days** over bounding box `60,23,78,38`. Keep the **180-minute database cooldown** across every manual/scheduled trigger. Store the satellite source with each observation; reject invalid CSV and mark partial failures as errors.
- Module 1 `routes.ts`: public `/fires/latest` searches 4 days to avoid boundary/timezone omissions from a 3-calendar-day NASA response.
- Module 2 `SatelliteDashboard.tsx`: remove large empty fire card; keep useful imagery/rainfall map; show an accurate no-detections message.
- New test file for FIRMS sensor selection, cooldown, API window and empty-state contract.

**This cannot create real detections.** If NASA has no VIIRS observations in the query window, zero records are correct. FIRMS results are thermal anomalies, not confirmed fires. Geographical filter is a rectangle including some territory outside Pakistan; avoid calling these Pakistan-border-filtered counts.

## Installation
Extract ZIP over PCI_Clean, overwriting the files. Run:

```
npm --prefix Module_1_Adapter test
npm --prefix Module_1_Adapter run build
npm --prefix Module_2_Public_Website test
npm --prefix Module_2_Public_Website run build
```

Only after tests pass:
```
git add Module_1_Adapter/src/modules/satellite/service.ts Module_1_Adapter/src/modules/satellite/routes.ts Module_1_Adapter/tests/satellite-three-sensor.test.mjs Module_2_Public_Website/src/components/SatelliteDashboard.tsx
git commit -m "Expand FIRMS coverage and clarify empty satellite data"
git push origin main
```

Deploy **Modules 1 and 2** on Hostinger. The FIRMS provider stays enabled with `180` minutes in Management. Since the last NASA poll just succeeded, the strict cooldown prevents another poll until 180 minutes after that attempt; **do not retry to bypass it**. After the next scheduled run, check the provider's last attempt/success and the public map.

API usage: 3 sensors x 3-day API window x 8 scheduled refreshes per day = **approximately 72 counted transactions per day**, assuming NASA counts one per day of requested data, no retries or other key consumers. NASA notes that multi-day requests cost multiple transactions; monitor actual usage on NASA's official key-status page. Existing credentials must remain in Hostinger environment variables only. Rotate previously disclosed keys.

## Limitations
Not live-tested against NASA because no production key or server access was used. Existing full build and app integration must be verified before deployment. The test file is intentionally compatible with Node's native test runner.
