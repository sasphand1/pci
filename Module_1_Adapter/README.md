# PCI (Pulsr)

Rankings and data for Pakistan's creators, restaurants and more. Three separately hosted modules share one data hub.

## Repository layout

| Folder | What it is |
| --- | --- |
| `Module_1_Adapter` | Node.js + Express API and worker: collection, the Data Hub, ranking engine, publication, public and admin APIs (PostgreSQL on Neon, Redis). |
| `Module_2_Public_Website` | Next.js public site. |
| `Module_3_Admin_Panel` | Next.js admin / control panel (includes the Data Hub page). |
| `docs` | Ranking formulae, satellite runbooks and the Data Hub API description. |
| `start-module-1.cmd` … `start-module-3.cmd` | Start a module locally with Docker. |

## Data Hub

Every collected reading is stored once in the hub (`ingest_observations`, latest values in `ingest_latest`), official APIs first and web sources only as a permitted fallback. Rankings, the public site, creator profiles, analytics and coverage checks all read from the hub. Any category can be added as a source (creators, places, prices, air quality, trends); published rankings are kept permanently in `rank_history` for the hall of fame.

- Hub admin API: `GET /api/v1/admin/ingest/openapi.json` (signed-in admins), also checked in at `docs/hub-openapi.json` — open it in any Swagger / OpenAPI viewer.
- Public API with Swagger UI: `/docs` on Module 1.
- Health, alerts and stored data per category: the **Data Hub** page in the admin panel.

## Checks

```
cd Module_1_Adapter
npm ci
npm run check
```

CI (`.github/workflows/ci.yml`) also applies all migrations to an empty PostgreSQL database and runs the database tests.
