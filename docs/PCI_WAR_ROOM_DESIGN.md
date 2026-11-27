# PCI War Room — master visual and intelligence requirements

Status: approved visual direction; implementation candidate based on GitHub main `def0c8343fd33726d95be5d054827f7ed5d24130`.

## Locked visual requirements

- The War Room is an immersive AR environment, not a conventional dashboard placed over wallpaper. The interface floats inside the environment as if viewed through augmented-reality glasses.
- Use the approved underground developer warehouse artwork: the metal shop shutter, hand-drawn Ranked and PCI War Room graffiti, industrial structure, platform signs, illuminated realistic Earth display, lounge and visibly steaming coffee. Do not replace or redesign this artwork without explicit approval. The WebP is a compression of the selected original, not another generated scene.
- On the War Room landing screen, collapse the existing desktop admin sidebar to its icons. Preserve every navigation destination and role. Allow expansion to restore the labels and access to account controls. The existing mobile menu remains available. Other routes retain their existing layout.
- Rename the admin navigation item to **War Room** while retaining `/broadcast` and existing engine endpoints. Use a large luminous War Room heading and the PCI wordmark, Launch Campaign on the left, the circular pink/red Enter War Room control in the middle, Transmission Status on the right, engine status above, and the downward Intelligence & Analytics affordance below. Entry controls only navigate; they must never transmit.
- Keep detailed graphs, campaign feedback, composer, exact message preview, red broadcast review button, history and audit trail beneath the landing screen. All interactive controls are actual accessible HTML/SVG, not baked into the artwork. Use translucent panels, thin neon borders and restrained blur; preserve readability, focus states, mobile behavior and reduced-motion/transparency preferences.
- All design CSS remains centralized in `Module_2_Public_Website/packages/ui/src/styles/broadcast.css` and the identical existing admin deployment mirror. No inline styles, new dependencies, standalone server or application.

## Campaign intelligence

The campaign selector is separate from the saved-draft authorization selection. It filters the latest 50 engine jobs, not a complete historical archive. Real counts include delivered, failed, uncertain, pending and claimed destination outcomes for confirmed campaigns, recent campaign creation/current confirmation trends, channel distribution, persisted campaign history and audit events. Do not treat a dispatcher-reported delivery as unique reach, views or independently verified publication.

Required feedback panels include outreach performance, messages sent per channel, campaign views/impressions/engagement, attributed website visits and clicks, subscriber growth, geographic reach, channel comparison and provider quotas. The existing engine does not provide these provider or first-party analytics, so the UI renders explicit unavailable states rather than fake numbers or zero-valued fabricated graphs. A future telemetry implementation must supply actual measured values, definitions, attribution, time range and freshness. The campaign creation graph is not a sent-message trend and is labeled accordingly.

The public distribution plan remains Email, Web Push, manual WhatsApp Channels, Facebook, Instagram, RSS and PCI Live Feed. Current engine destinations remain exactly as returned by the existing API (YouTube, Instagram, TikTok at this baseline); planned channels cannot be selected for live jobs. No video creation, new publishing adapters, real sends, quota promises, external costs or new database schema are included in this visual update.

## Release gates

Preserve the existing role gate, CSRF, idempotent draft requests, exact persisted payload review, explicit confirmation, cancellation and history. Existing tests must remain intact. Use fresh generated build outputs and run local typechecks/tests/builds followed by all GitHub CI checks (including adapter database integration tests) before merging. Verify the actual Hostinger deployment separately. Never treat a successful mocked browser test as proof of real provider transmission.
