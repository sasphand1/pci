# PCI Broadcast Engine — core foundation

Base archive: `a3fb5f4f3cc9e7a8c47d15e4d4ae1dcc0378c000`.

## Scope and explicit assumptions

This update implements the recovered requirement for an operator-controlled Broadcast tab, immutable review and explicit transmission confirmation. The complete earlier functional specification was not recoverable. YouTube, Instagram and TikTok are initial **candidate** destinations, based on PCI's previously discussed same-original-video workflow; the core is not a final specification for all editorial, intelligence, or distribution channels. It does not build media, generate scripts, select Data Hub readings, schedule campaigns, upload assets, or send to external platforms. The control room is a working operational UI, not a reproduction of the lost cinematic mockup. No demonstration numbers are substituted for real data.

## Ownership and boundaries

- Module 1 owns authorization, validation, queue, receipt and audit handling.
- The existing PostgreSQL database holds a new, isolated `broadcast` schema. There is no new database service. No existing tables are changed; operator actions append entries to the existing `admin_audit_logs` as well as the broadcast-specific event log.
- Module 3 uses the existing session, CSRF header and API client. Owner and Editor can access the control room; Moderator cannot. Module 2's public behavior is unchanged; only its shared `@pci/ui` stylesheet receives scoped control-room styles, mirrored in the existing admin deployment vendor directory.
- No dependency, lockfile, Redis, ranking, ingestion, public API, Satify, or scheduler changes. No new Hostinger service is required for the core.

## State and delivery semantics

1. Create an immutable draft with an operator-generated request UUID, title, caption, optional original-media reference and one or more unique destinations. Repeating an identical request UUID as the same actor returns the original record. A different payload under that UUID is rejected.
2. Review the persisted draft. The red button opens review; a second explicit action confirms. Drafts cannot be claimed. Confirmation makes the target rows eligible for claim, and does not send a platform request itself.
3. A trusted external dispatcher claims a single target atomically, using a fresh claim UUID. Parent-job row locking plus `SKIP LOCKED` serializes competing claims and cancellation. The returned stable delivery UUID can be used as a downstream idempotency key where the provider supports it.
4. The dispatcher reports a definitive provider response or an uncertain result. A delivered receipt requires the external post ID; this is **dispatcher-reported**, not independently verified by PCI. Identical receipt retries are safe. Conflicting terminal receipts are rejected. An explicitly uncertain receipt can later be reconciled to delivered or failed.
5. A claimed delivery without a receipt after 15 minutes is shown as uncertain / attention needed. It is never automatically requeued. A delayed matching receipt can resolve it. No automatic resend is implemented, since platform timeouts may hide a successful post. A new draft is a new transmission, not a safe retry.
6. Cancellation is permitted only before *any* destination is claimed. Cancellation cannot revoke a post already published or claimed by a dispatcher. After dispatch begins, unclaimed targets still remain eligible. Do not confirm a draft unless all selected targets are authorized.

The overview displays the latest 50 jobs; a known UUID can be retrieved directly, including the latest 100 audit events. Long-term data retention and full archive/pagination are future decisions. Confirmed jobs are durable with no automatic expiration: disable dispatch and cancel unclaimed unwanted jobs before enabling an adapter. Retrying a browser draft after a lost response retains the same request UUID while that form remains open; reloading loses this local retry identifier.

## Deployment

Apply migration `124_broadcast.sql` through the normal migration CLI or existing API startup bootstrap. Bootstrap uses the migration lock and idempotent SQL. Standard startup logs report whether it succeeded. If database permissions prevent it, the rest of PCI remains available and the Broadcast route reports an error. Use a staging deployment first. Deploy Module 1 before Module 3. The existing Hostinger environment remains sufficient for the queue. Leave `PCI_BROADCAST_DISPATCH_TOKEN` blank for local/staging UI tests; claims and receipts return 503 when unset or invalid. A configured token alone does not mean any publisher is running.

For a future external adapter (e.g. the previously planned n8n workflow), generate a high-entropy token of 32–256 characters, store it only as a Module 1 environment secret and in the adapter's server-side credential store. Local Compose passes the optional variable to API only. Use HTTPS in production. Do not expose it to the admin browser. The token grants access to all three candidate destinations. Use a trusted dispatcher and rotate the credential on compromise.

## API contract

All responses use existing PCI `{ "data": ... }` envelope. Errors use existing PCI structured error format. Admin routes require an authenticated PCI Owner/Editor session, and all writes require `X-CSRF-Token`.

| Method | Endpoint | Contract |
|---|---|---|
| GET | `/api/v1/admin/broadcast` | Recent jobs, destinations, dispatch credential configured flag |
| POST | `/api/v1/admin/broadcast` | Save draft |
| GET | `/api/v1/admin/broadcast/:id` | Full job, per-channel state and event history |
| POST | `/api/v1/admin/broadcast/:id/confirm` | Body `{ "confirm": true }` |
| POST | `/api/v1/admin/broadcast/:id/cancel` | Body `{ "confirm": true }` |
| POST | `/api/v1/broadcast/dispatch/claim` | Server-only bearer token; `{ "destination": "instagram", "claimId": "<fresh UUID>" }` |
| GET | `/api/v1/broadcast/dispatch/claims/:claimId` | Server-only read-only recovery lookup; no send payload |
| POST | `/api/v1/broadcast/dispatch/deliveries/:id/receipt` | Server-only bearer token; matching claim UUID, outcome, provider ID or result code |

Draft body:

```json
{
  "requestId": "8d841011-617c-4473-a21a-92f6e674f297",
  "title": "PCI update",
  "body": "Reviewed caption",
  "mediaRef": "originals/video-001.mp4",
  "destinations": ["youtube", "instagram", "tiktok"]
}
```

`mediaRef` is an opaque controlled asset identifier, not an arbitrary URL. The dispatcher must resolve it in its allowlisted asset store, verify its identity, rights, media validity and platform requirements, and use the same original artifact for each applicable destination. Never interpret it as an arbitrary filesystem path or URL. A null reference is accepted for the generic draft foundation; platform-specific adapters must reject an incompatible payload before sending anything.

The claim response contains `jobId`, `deliveryId`, `claimId`, `destination`, `idempotencyKey`, `deadline`, `title`, `body`, `mediaRef`. `{ "data": null }` means no work at that instant. A claim UUID already used to claim a delivery is rejected with 409: **do not send again**. A transport failure while claiming is ambiguous; use the read-only claim lookup to recover the delivery ID and reconcile the missing receipt rather than attempting to resend the original delivery. The dispatcher must not initiate transmission after the deadline, must persist the claim and provider receipt in its own durable storage before acknowledging PCI, and must retry the *receipt*, not the provider send, on acknowledgment failure. Platform APIs and exact idempotency support require separate validation.

Example success receipt:

```json
{
  "claimId": "<claim UUID from claim response>",
  "outcome": "delivered",
  "externalId": "<actual provider post ID>",
  "code": null
}
```

For a definitive failure use `outcome: "failed"`, `externalId: null`, and a nonsecret bounded code such as `INVALID_MEDIA`. For ambiguous delivery use `outcome: "uncertain"`, `externalId: null`, `code: "PROVIDER_TIMEOUT"`. Do not place tokens, raw provider responses, or private content in receipt codes or IDs. Later reconciliation uses the original claim ID and a definitive receipt.

## Tests and known limitations

- Six deterministic state/idempotency tests run without dependencies using Node 22 with `--experimental-strip-types`.
- PostgreSQL tests added to the existing `test:db` and CI sequence. They require the existing base migrations and a separate `*_test` database. They exercise repeated bootstrap, draft replay, confirmation, cancellation, concurrent claim, receipt replay, stale claim and reconciliation.
- No actual external adapter, provider credentials, social posting, platform compliance validation, live analytics, browser visual review, or live PostgreSQL execution is included in this delivery. Do not enable production dispatch until the actual workflow and adapters have been agreed, implemented and validated.
- Rollback: disable the dispatch credential and deploy the previous code. Preserve broadcast tables for audit/reconciliation; do not drop them or blindly resend outstanding items.

### Local verification of the delivery

| Check | Result |
|---|---|
| Broadcast state/idempotency tests | 6/6 passed |
| Module 1 dependency-free suite | 290/291 passed; existing public-header assertion fails identically on the untouched archive |
| Module 2 dependency-free suite | 163/164 passed; existing Fifi theme/native modal assertion fails identically on the untouched archive |
| Module 3 dependency-free suite | 54/54 passed |
| Changed TS/TSX files syntax transpilation | 9 files, no diagnostics (not a full typecheck) |
| Full dependency installation and builds | Blocked: npm registry DNS resolution failed (`EAI_AGAIN`); Node type definitions and Next.js unavailable |
| PostgreSQL integration tests | Added to CI and test:db, not executed locally (no PostgreSQL service and dependencies) |

The two pre-existing failures are left untouched. This is a review/staging candidate, not a fully verified production release.
