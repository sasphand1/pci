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
| airquality | Copernicus CAMS via Open-Meteo | US AQI, PM2.5, PM10, NO2, ozone, dust, UV; hourly, 8 cities, next-24h peak | 1 h | – |
| weather | Open-Meteo | Current weather and 7-day forecast, heat days, 8 cities | 1 h | – |
| flood | GloFAS via Open-Meteo | River discharge today, past 7 days and 30-day forecast peak at 11 points (Indus, Jhelum, Chenab, Ravi, Sutlej, Kabul, Swat) | daily | – |
| gdacs | GDACS (UN / EC) | Disaster alerts (EQ, cyclones, floods, drought, fires, volcanoes) for Pakistan and the Arabian Sea approach | 1 h | – |
| swpc | NOAA SWPC | Space weather: estimated Kp and G-scale | 3 h | – |
| celestrak | CelesTrak GP | Orbital elements for ISS, Tiangong and other stations (for pass prediction) | 6 h | – |
| openaq | OpenAQ v3 | Ground air-quality stations (measured) | 1 h | `OPENAQ_API_KEY` |

Removed in v4: Sentinel-1, Sentinel-2, Sentinel-5P, Landsat, ECOSTRESS, SMAP and Black Marble catalogue listings (metadata only, no usable numbers). Their stored rows are deleted by migration 118.

Public API (Module 1, `/api/v1/satellite`): `/air-quality/latest?city=`, `/air-quality/history?city=&hours=`, `/air-stations/latest`, `/weather/latest?city=`, `/rivers/latest`, `/alerts/latest`, `/space-weather/latest`, `/orbits/latest`, `/imagery/layers`, plus the existing fire, rainfall, solar, earthquake, natural-event and imagery routes. OpenAPI: `/api/v1/satellite/openapi.json`.

Licences: Open-Meteo data is free for non-commercial use; a commercial Pulsr needs an Open-Meteo API plan (or direct Copernicus access). Attribute Copernicus/CAMS, GloFAS, NASA, USGS, GDACS, NOAA, CelesTrak and OpenAQ on the page. None of these outputs is an official PMD, NDMA or FFD warning.
