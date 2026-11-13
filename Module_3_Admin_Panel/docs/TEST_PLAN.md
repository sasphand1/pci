# Module 3 — Verification plan

## Automated checks
- `npm test`: structural checks, centralized CSS, route inventory, credential handling, role navigation, Docker setup.
- `npm run typecheck`: requires npm dependency installation.
- `npm run build`: requires npm dependency installation, Next.js and the sibling shared `@pci/ui` package.

## Manual integration checklist (required before production)
1. Start Module 1 (database + Redis + API + worker); check `/health/ready`.
2. Create the first owner via CLI; enroll TOTP. Verify wrong password/wrong TOTP fails without setting an auth cookie.
3. Sign in to Module 3 on 3001. Refresh the page and verify `GET /admin/auth/me` restores session/CSRF.
4. Verify an Editor cannot access Owner/Moderator routes by manually calling the API; a Moderator cannot modify creators or settings.
5. Verify logging out invalidates the session, and password rotation invalidates all existing sessions.
6. Add a valid UC channel ID; verify API validation and duplicate detection. Create/patch/disable creators. Import a batch only after a verified YouTube API key is configured.
7. Create/update categories. Verify public site category navigation reflects updates.
8. Trigger a manual sync and watch queued->running->succeeded/failed; verify partial errors display and public snapshot is not corrupted.
9. Preview rankings with subscriber/view/video sorts; compare to raw API counts; verify hidden subscriber values remain unranked and 64-bit counts are formatted accurately.
10. Hide/unhide a video; verify public site response changes.
11. Post from a guest and a registered account on the public wall. Report a post and resolve/dismiss/delete it from the admin wall. Ban/unban author and verify subsequent posting is denied/restored.
12. Change wall settings and verify immediate behavior; test forbidden words and slow mode under load.
13. Create an Editor and a Moderator, enroll both in TOTP securely. Disable and reactivate a non-owner account; confirm session invalidation.
14. Confirm audit records for sensitive actions, no secrets in browser localStorage, no plaintext password in logs, and no admin UI data is indexable by search engines.
15. Test Windows desktop, mobile viewport, reconnects, offline errors, expired cookies, expired CSRF, quota exhaustion and malformed API responses.
16. Behind HTTPS reverse proxy, test cookie SameSite behavior and CORS, only trusted `ADMIN_ORIGIN`, Turnstile for wall guests, SMTP, backup/restore, patch monitoring and penetration tests.

Tests here do NOT constitute a complete security audit. A Node test suite cannot replace deployed integration and browser tests.
