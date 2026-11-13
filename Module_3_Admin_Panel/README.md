# Pakistan Creator Index — Module 3: Management Panel

A real Next.js administrator GUI for the **existing Module 1 API**. Runs separately from the Module 2 public website. It never accesses PostgreSQL, Redis or YouTube directly.

## Centralized UI (strict rule)

`@pci/ui` lives in `../Module_2_Public_Website/packages/ui/`. Both Module 2 and Module 3 import `@pci/ui/styles.css`, which imports `tokens.css`, `base.css`, `layout.css`, `components.css`, `responsive.css`, and `admin.css`. **There is only one design-system package and one CSS entry point.** Admin-specific styles are centralized in that same package. No inline CSS, embedded style blocks, CSS-in-JS, or local page-level styles. Do not extract Module 3 into a folder without its sibling Module 2, or the shared theme dependency won't resolve.

## Windows CMD — run three modules separately

Module 1 (Docker):

```bat
cd Module_1_Adapter
copy .env.example .env
notepad .env
docker compose up -d --build
curl.exe http://localhost:8080/health/ready
```

Module 2 (second CMD window):

```bat
cd Module_2_Public_Website
copy .env.example .env.local
npm install
npm run dev
```

Module 3 (third CMD window):

```bat
cd Module_3_Admin_Panel
copy .env.example .env.local
npm install
npm run dev
```

Use `http://localhost:3001` for the admin panel; public site is `http://localhost:3000`; adapter is `http://localhost:8080`. See the top-level README for exact paths from the combined directory and first-owner setup.

**Run `npm install` instead of `npm ci` on initial installation:** no lockfile could be generated while the source was built offline. Commit the resulting lockfiles for repeatable production builds.

## Admin authentication

- Module 1 sets an HttpOnly `pci_admin` cookie with `SameSite=Strict` and validates TOTP MFA on login.
- Every privileged mutation includes a server-validated `X-CSRF-Token`, retrieved from login or `/admin/auth/me`.
- Cookies are sent with `credentials: 'include'`; Module 1's `ADMIN_ORIGIN` must exactly match this frontend origin (`http://localhost:3001` locally).
- No admin password, MFA enrollment secret, CSRF token or auth cookie is persisted in `localStorage` or `sessionStorage`.
- Role restrictions are applied in the UI for usability and *again* enforced by Module 1 as the authority.
- The first Owner must be created via the Module 1 CLI, not by an unauthenticated website route.

## Features

Overview; creator validation/add/edit/disable/bulk JSON import; category CRUD; scheduled/manual sync operations; raw ranking preview and default; video visibility; wall reports/messages/bans; homepage announcement and featured-creator controls; Owner/Editor/Moderator accounts and one-time MFA setup material; platform health; settings; audit log; own password rotation.

Module 1 does **not** yet expose APIs for logos, legal-page editing, MFA re-enrollment, or active ban listing. These are documented limitations, not silent dummy buttons.

## Docker (optional)

Docker build uses the **parent** context to access the single shared UI package:

```bat
docker compose up -d --build
```

Run this command *from the Module_3_Admin_Panel directory after extracting the combined ZIP*. It binds port 3001 on loopback; secure public exposure requires an HTTPS reverse proxy and an explicit deployment review.

## Quality checks

```bat
npm test
npm run typecheck
npm run build
```

See `docs/TEST_PLAN.md` for integration and security acceptance checks, and `docs/ADMIN_API_MAP.md` for authoritative endpoint mapping.
