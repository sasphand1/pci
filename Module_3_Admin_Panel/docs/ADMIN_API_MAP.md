# Module 3 — API map (actual Module 1 endpoints)

All requests use `NEXT_PUBLIC_ADAPTER_API_URL` plus `/api/v1`. Cookies are HttpOnly and set by Module 1. The panel keeps the CSRF token in memory and rehydrates it via `/admin/auth/me`. Never use localStorage for admin sessions. Only roles named below can invoke an endpoint; Module 1 enforces this server-side.

| Screen | Actual endpoints | Roles |
|---|---|---|
| Login/session | `POST /admin/auth/login`, `GET /admin/auth/me`, `POST /admin/auth/logout` | All |
| Overview | `GET /admin/dashboard` | All |
| Creators | `GET/POST /admin/creators`, `POST /admin/creators/validate`, `POST /admin/creators/bulk`, `PATCH/DELETE /admin/creators/:id` | Owner, Editor |
| Categories | `GET/POST /admin/categories`, `PATCH /admin/categories/:id` | Owner, Editor (GET all) |
| Sync | `GET/POST /admin/sync-runs` | Owner, Editor |
| Rankings | `GET /admin/ranking-preview`, `GET /admin/settings`, `PATCH /admin/settings` (owner only) | Preview: Owner, Editor |
| Video catalogue | `GET /admin/videos`, `PATCH /admin/videos/:id` | Owner, Editor |
| Live wall | `GET /admin/wall/messages`, `GET/PATCH /admin/wall/reports`, `DELETE /admin/wall/messages/:id`, `POST /admin/wall/bans`, `DELETE /admin/wall/bans/:type/:id` | Owner, Moderator |
| Content | `GET /admin/settings`, `PATCH /admin/settings` (owner), `PATCH /admin/creators/:id` (featured) | Owner, Editor as allowed |
| Admin accounts | `GET/POST /admin/admins`, `PATCH /admin/admins/:id` | Owner |
| My security | `POST /admin/admin-password` | All |
| System | `GET /admin/system-health` | Owner |
| Settings | `GET /admin/settings`; `PATCH /admin/settings` | Read: all; write: Owner |
| Audit | `GET /admin/audit-logs` | Owner |

**Known contract limitations**: no endpoint for uploading logos, editing legal pages, listing active bans, revoking a particular admin session without disabling/changing role, or MFA secret re-enrollment. The UI does not pretend these controls exist. Module 2 legal/about/contact content remains source-managed; the site template is owned by Module 2 and shared with this admin.

**Owner bootstrap** is via the Module 1 CLI: `docker compose run --rm api node dist/cli/create-owner.js owner@example.com` from the Module 1 directory. The admin GUI does not expose an unsecured first-owner form.
