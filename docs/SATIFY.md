# Satify: Satisfy yourself

Satify turns free public data into WhatsApp packs. Every number carries a badge (Measured, Official, Forecast, Estimate), its source and its time.

## Pieces
- **Satify Hub** (Module 1, schema `satify`): sources, latest signals, full history, official entries, packs, subscribers, events, deliveries. Key numbers are mirrored into the main PCI hub (category `satify`).
- **Free sources only**: MET Norway weather, Copernicus CAMS air quality (ADS) and GloFAS river flow (EWDS), aviationweather.gov METAR visibility, Frankfurter (SBP rate) with open.er-api.com backup, xaus.com gold. No Open-Meteo. Official entries (petrol, Sarafa tola, open-market dollar, school notices, NHMP notices, Section 144, top trend) are typed in the admin panel with a source link.
- **Connector engine** (scalable): quick JSON sources run as chains (first source, then backups). Copernicus data stores prepare files as queued jobs, so `modules/satify/jobs.ts` submits, polls, downloads and decodes GRIB (`grib.mjs`) over several minutes. A new Copernicus dataset is one entry in `JOB_CONNECTORS` plus a `satify.sources` row; a new JSON source is one parser in `sources.mjs` plus one chain line.
- **Engine**: every minute (scheduler): collect, derive (fog risk, fog clearing time, school-closure chance, motorway status), then send due daily briefs and urgent alerts. A message is held back when required data is missing or stale (shown in the admin overview).
- **Packs**: built in the admin Pack Builder. One shared WhatsApp template (`satify_alert`) serves every pack, so a new pack needs no new Meta approval.
- **Public page**: `/satify` (old `/satellite` redirects). Packs show with join codes and QR codes.

## Copernicus setup (once)
1. Create a free ECMWF account. Sign in on the ADS (ads.atmosphere.copernicus.eu) and the EWDS (ewds.climate.copernicus.eu).
2. Accept the licences of "CAMS global atmospheric composition forecasts" (ADS) and "GloFAS forecast" (EWDS) on their dataset pages.
3. Copy each API key (How-to-API page) into `COPERNICUS_ADS_KEY` and `COPERNICUS_EWDS_KEY` in the Module 1 Hostinger environment.
4. Admin → Satify overview → Copernicus jobs shows each run (submitted → done). Air quality refreshes twice a day (each CAMS run), river flow daily.

## Go live
1. Module 1 Hostinger environment: set the `WHATSAPP_*` variables and `SATIFY_CONTACT` (see `.env.example`). Keep `SATIFY_DELIVERY_MODE=dry_run`.
2. Meta app → WhatsApp → Configuration → Webhook: callback `https://<module-1-host>/api/v1/satify/whatsapp/webhook`, verify token = `WHATSAPP_VERIFY_TOKEN`, subscribe to `messages`.
3. Admin → Satify overview → "Submit alert template to Meta". Wait for approval in WhatsApp Manager.
4. Admin → Packs → Parents → "Send test to me". Check the message on your phone.
5. Set `SATIFY_DELIVERY_MODE=live` and redeploy Module 1.

## WhatsApp commands
`JOIN PARENTS LAHORE`, `JOIN MOTORWAY M2`, `JOIN PULSE KARACHI`, `LIST`, `STOP PARENTS`, `STOP` (leave all).

## Licensing notes
MET Norway: CC BY 4.0 / NLOD, credit shown. Copernicus (CAMS, GloFAS): free, including commercial use, with the Copernicus attribution. open.er-api.com: attribution "Rates by Exchange Rate API". The Motorway pack is a placeholder (coming soon) until its own update.
