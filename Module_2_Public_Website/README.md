# Pakistan Creator Index — Module 2: Public Website

A **functional Next.js public frontend** for the Module 1 Adapter. This is **not** the admin panel; that is Module 3. The site never talks directly to PostgreSQL, Redis or YouTube. It uses only Module 1 REST and Socket.IO APIs.

## The single-template rule (strict)

**All UI styling lives in `packages/ui/src/styles/`.** `packages/ui/src/styles.css` is the ONLY stylesheet imported by the app, at `src/app/layout.tsx`. No page embeds CSS, `style` prop, CSS-in-JS, `<style>` tag, or a second design system. Pages use named semantic classes and components from the reusable `@pci/ui` workspace package. Module 3 should consume **the same `@pci/ui` package** to share typography, colors, forms, tables, spacing and responsive behavior. To change the brand, edit `tokens.css` first.

## Requirements

- Node.js 22+, npm 10+
- A running copy of Module 1, exposing API on port 8080
- PostgreSQL and Redis connected to Module 1 (the frontend uses neither directly)

### Local Windows CMD

```bat
cd Pakistan_Creator_Index_Module_2
copy .env.example .env.local
npm install
npm run dev
```

Visit `http://localhost:3000`. For a first real-data test, open `http://localhost:8080/health/ready` and ensure Module 1 has creator records and a completed sync. No sample creator statistics are shipped. If the adapter is offline, pages show explicit empty or offline states.

**This frontend uses `npm install` rather than `npm ci` because a lockfile could not be generated without package registry access in the build environment. Generate and commit the resulting `package-lock.json` before production, then switch Docker to `npm ci`.**

### Docker Compose (Windows/VPS)

Run Module 1 on port 8080 first, then from this directory:

```bat
copy .env.example .env
set NEXT_PUBLIC_ADAPTER_API_URL=http://localhost:8080
set ADAPTER_INTERNAL_URL=http://host.docker.internal:8080
set NEXT_PUBLIC_SITE_URL=http://localhost:3000
docker compose up -d --build
docker compose ps
```

Windows Docker Compose maps `host.docker.internal` to the host machine. On a VPS use your actual adapter private network name/URL and valid HTTPS public API origin. Browser `NEXT_PUBLIC_*` variables are baked in at **build time**; rebuild the public website if they change. Server-side `ADAPTER_INTERNAL_URL` is set at runtime. `NEXT_PUBLIC_ADAPTER_API_URL` is not a secret.

### Mandatory Module 1 configuration

Match **exact origins** in Module 1:

```env
PUBLIC_ORIGIN=http://localhost:3000
ADMIN_ORIGIN=http://localhost:3001
APP_PUBLIC_URL=http://localhost:3000
```

Enable the correct Turnstile **site key** in the public frontend and the corresponding **secret key** and expected hostname in Module 1. In production the backend must require bot verification. Registered accounts also require SMTP to deliver verification and reset links. Keep all secrets out of this frontend.

### Public features

- Home: platform overview, actual cached backend statistics, latest snapshot date, categories, directory highlights.
- Directory: search, category filtering, raw-metric sort, pagination.
- Rankings: subscriber count (default), channel views, video count; no unsupported composite scores.
- Creator profile: reported channel stats, sample sums/means from up to latest 50 uploads, recent video cards.
- Category pages, creator comparison, limited video explorer, methodology/about/legal information pages.
- Single shared live wall: guest sessions, registered members, Cloudflare Turnstile, realtime Socket.IO, moderation report UI, presence indicator, reconnect and catch-up.
- Registered accounts: register, verify email, log in, log out, forgot/reset password, account deletion.
- Search-friendly metadata, sitemap, robots, consistent responsive layout, reduced-motion support.

### Testing

```bat
npm test
npm run typecheck
npm run build
npm run start
```

The dependency-free `npm test` runs structural, data-formatting, API contract, and central-style rules. `typecheck` and `build` require an online dependency install. Integration tests of Module 1, real YouTube, Redis, PostgreSQL, WebSocket traffic and Turnstile must be run locally before launch. See `docs/TEST_PLAN.md`.

### Website pages

`/`, `/rankings`, `/creators`, `/creators/[slug]`, `/categories`, `/categories/[slug]`, `/compare`, `/videos`, `/wall`, `/account`, `/verify-email`, `/reset-password`, `/methodology`, `/about`, `/privacy`, `/terms`, `/contact`.

### Security and operational notes

- **Client storage:** Module 1 V1 exposes a bearer-token-only public wall session. Module 2 stores it in browser `sessionStorage` (not localStorage) and clears it on logout. This is susceptible to malicious scripts if a frontend XSS vulnerability occurs. For a production-hardened follow-up, add same-origin HttpOnly cookie sessions via a BFF proxy; that requires a coordinated Module 1 contract change. Never store admin credentials in this public site.
- API and WebSockets are allowed only from Module 1's configured `PUBLIC_ORIGIN`; ensure HTTPS for production.
- All server-side public fetches are no-store (freshness is controlled by Module 1's Redis TTL). No fake ranking data or fallback statistics are shipped.
- External videos open YouTube; thumbnails are restricted to permitted YouTube CDN hosts.
- Public pages never use `dangerouslySetInnerHTML`. User chat is shown as plain text.
- In Module 1, publication is transactional and backend rate limits are authoritative. UI controls cannot override them.
- The Privacy/Terms/Contact pages are implementation drafts and **require a real operator's details and legal review before public launch.**

## Next module: Admin Panel

Reuse `packages/ui` as a shared design-system package, with an admin shell (sidebar, dashboard layout) added to `packages/ui/src/styles/layout.css`, and keep all visual rules centralized. Do not clone the CSS or invent a second theme. Module 3 must talk to the existing `/api/v1/admin/*` contract, not the database.
