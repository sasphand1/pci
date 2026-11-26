# Satellite / Earth data sources (v4)

All Earth data is stored twice: full detail in `satellite.observations` (for the Satellite page) and comparable numbers in the PCI hub under category **satellite** (one hub, sub-buckets per category). Hub sources are `sat_<provider>.api`; health, staleness and alerts appear on the admin Data Hub page.

| Provider id | Source | What it gives | Refresh | Key |
|---|---|---|---|---|
| firms | NASA FIRMS (VIIRS) | Fire / heat hotspots, Pakistan | 3 h | `NASA_FIRMS_MAP_KEY` |
| power | NASA POWER | Daily rainfall and sunlight, 8 cities (2-7 days late) | daily | – |
| eonet | NASA EONET | Natural events | 6 h | – |
| usgs | USGS ComCat | Earthquakes | 1 h | – |
| gibs | NASA GIBS | Map layers: true colour, night lights, dust/haze (AOD), snow cover (each verified by a live tile probe) | daily | – |
| gpm | NASA GPM IMERG | Rain-rate map image | 6 h | – |
| airquality | Copernicus CAMS global forecast (ADS job, via Satify Hub) | US AQI, PM2.5, PM10, NO2, ozone, dust, UV; hourly, 8 cities, next-24h peak | 1 h | – |
| weather | MET Norway Locationforecast | Current weather and 7-day forecast, heat days, fog, 8 cities | 3 h | – |
| flood | Copernicus GloFAS control forecast (EWDS job, via Satify Hub) | River discharge today, past 7 days and 30-day forecast peak at 11 points (Indus, Jhelum, Chenab, Ravi, Sutlej, Kabul, Swat) | daily | – |
| gdacs | GDACS (UN / EC) | Disaster alerts (EQ, cyclones, floods, drought, fires, volcanoes) for Pakistan and the Arabian Sea approach | 1 h | – |
| swpc | NOAA SWPC | Space weather: estimated Kp and G-scale | 3 h | – |
| celestrak | CelesTrak GP | Orbital elements for ISS, Tiangong and other stations (for pass prediction) | 6 h | – |
| openaq | OpenAQ v3 | Ground air-quality stations (measured) | 1 h | `OPENAQ_API_KEY` |

Removed in v4: Sentinel-1, Sentinel-2, Sentinel-5P, Landsat, ECOSTRESS, SMAP and Black Marble catalogue listings (metadata only, no usable numbers). Their stored rows are deleted by migration 118.

Public API (Module 1, `/api/v1/satellite`): `/air-quality/latest?city=`, `/air-quality/history?city=&hours=`, `/air-stations/latest`, `/weather/latest?city=`, `/rivers/latest`, `/alerts/latest`, `/space-weather/latest`, `/orbits/latest`, `/imagery/layers`, plus the existing fire, rainfall, solar, earthquake, natural-event and imagery routes. OpenAPI: `/api/v1/satellite/openapi.json`.

Licences: every source is free, including commercial use (MET Norway with credit; Copernicus CAMS and GloFAS with the Copernicus attribution). Attribute Copernicus/CAMS, GloFAS, NASA, USGS, GDACS, NOAA, CelesTrak and OpenAQ on the page. None of these outputs is an official PMD, NDMA or FFD warning.

## Combined scores (v5)

Built in `Module_1_Adapter/src/modules/satellite/insights.mjs` from stored observations only (enabled sources):

| Card | Inputs | Endpoint |
|---|---|---|
| Go-Out Score 0-100 (good / fair / limit / avoid) | CAMS AQI, feels-like max, UV, rain chance | `/insights?city=` |
| Smog and heatwave watch | hourly AQI (7 days), 7-day forecast | `/insights?city=` |
| Is my area safe today | GDACS, USGS (300 km, 7 days), FIRMS (50 km), GloFAS (150 km) | `/insights?city=` |
| Farm: irrigation, spray window, heat stress, river | NASA POWER rain, forecast, GloFAS | `/insights?city=` |
| Industry: solar, insurers/banks, logistics, power, telecom/GPS, health | all of the above + Kp | `/insights?city=` |
| Weekly city rankings | 7-day AQI average, peak feels-like, POWER rain, Go-Out Score | `/rankings/weekly` |

Go-Out Scores and ranking winners are written to the Data Hub as source `sat_insights.api` (category satellite)
after every air-quality or weather collection. None of these are official PMD, NDMA or FFD warnings.
The globe propagates CelesTrak elements in the browser (`public/satellite-orbits.js`, Kepler + J2): good for a live dot, not for pass predictions.
