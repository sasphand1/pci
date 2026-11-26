# Satify: Satisfy yourself

Satify turns free public data into WhatsApp packs. Every number carries a badge (Measured, Official, Forecast, Estimate), its source and its time.

## Pieces
- **Satify Hub** (Module 1, schema `satify`): sources, latest signals, full history, official entries, packs, subscribers, events, deliveries. Key numbers are mirrored into the main PCI hub (category `satify`).
- **Free sources**: MET Norway weather (Open-Meteo only as backup), Copernicus CAMS air, aviationweather.gov METAR visibility, Frankfurter (SBP rate) with open.er-api.com backup, xaus.com gold. Official entries (petrol, Sarafa tola, open-market dollar, school notices, NHMP notices, Section 144, top trend) are typed in the admin panel with a source link.
- **Engine**: every minute (scheduler): collect, derive (fog risk, fog clearing time, school-closure chance, motorway status), then send due daily briefs and urgent alerts. A message is held back when required data is missing or stale (shown in the admin overview).
- **Packs**: built in the admin Pack Builder. One shared WhatsApp template (`satify_alert`) serves every pack, so a new pack needs no new Meta approval.
- **Public page**: `/satify` (old `/satellite` redirects). Packs show with join codes and QR codes.

## Go live
1. Module 1 Hostinger environment: set the `WHATSAPP_*` variables and `SATIFY_CONTACT` (see `.env.example`). Keep `SATIFY_DELIVERY_MODE=dry_run`.
2. Meta app → WhatsApp → Configuration → Webhook: callback `https://<module-1-host>/api/v1/satify/whatsapp/webhook`, verify token = `WHATSAPP_VERIFY_TOKEN`, subscribe to `messages`.
3. Admin → Satify overview → "Submit alert template to Meta". Wait for approval in WhatsApp Manager.
4. Admin → Packs → Parents → "Send test to me". Check the message on your phone.
5. Set `SATIFY_DELIVERY_MODE=live` and redeploy Module 1.

## WhatsApp commands
`JOIN PARENTS LAHORE`, `JOIN MOTORWAY M2`, `JOIN PULSE KARACHI`, `LIST`, `STOP PARENTS`, `STOP` (leave all).

## Licensing notes
MET Norway: CC BY 4.0 / NLOD, credit shown. open.er-api.com: attribution "Rates by Exchange Rate API". Open-Meteo (air quality, river flow, weather backup) is free for non-commercial use only: replace it with direct Copernicus CAMS / GloFAS access before the first sponsor or paid pack.
