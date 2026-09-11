# Verification record — 2026-09-11

Calendar follow-up: replaced the browser's Gregorian date popup with an RTL Jalali month/day picker shared by every date field. Uses the existing `jalaali-js` dependency, Persian months/digits, Saturday-first weeks, leap-aware month lengths, today/clear controls and keyboard navigation. Per the user's request for faster deployment, verification was limited to TypeScript, lint on the new component, production build and a focused deployment check; no broad UI suite was repeated.

This record describes executed checks, not a proposed test plan. Evidence uses synthetic demo/test data. Live model quality and actual payments are not claimed.

| Check | Result |
|---|---|
| TypeScript | `npm run typecheck` passed |
| Lint | Biome passed with 7 intentional `noImgElement` performance warnings; media is authenticated and pre-resized on upload, so the public Next image optimizer is not used |
| Production build | Passed on XDo with Node 22 from `docker.arvancloud.ir`; Linux-specific locked dependencies; standalone Next.js output |
| Unit tests | 8/8 passed: Jalali leap dates, Persian/Arabic numerals, half-open intervals, integer quote/deposit, state machine, strict eligibility and provider error cases |
| PostgreSQL integration | 9/9 reported passing (parent test plus 8 scenarios); actual concurrent transactions, self-rental/access denial, duplicate requests/events, one winning overlap, snapshot immutability, reports, adjacent intervals, expiry/cancellation |
| Persian request evaluation | 9/9 deterministic fallback cases passed; existing listing IDs and hard constraints checked; [JSON evidence](evidence/ai-evaluation.json) |
| HTTP acceptance | 24 assertions passed locally and on public HTTPS: auth required, foreign-origin denial, private demo isolation, image decoding/size, published-photo access and immediate revocation after pause, no-match and protected metrics |
| Real account auth | Local synthetic accounts: registration/login, wrong-password rejection, HttpOnly/SameSite cookie, logout invalidation, no demo-role switching and private listing owner checks passed |
| Persistence | Session, paused listing and exact 49,328-byte uploaded WebP persisted across application recreation/restart |
| Backup / restore | `/var/backups/torob-rent/20260911T072550Z`; checksum verification and restore into isolated `torob_restore_validation` succeeded (86 listings, 1 booking, 3 media at snapshot time); temporary validation DB removed afterward |
| Prometheus | Existing installation scrapes `torob-rent-app:3000`; `up{job="torob-rent"}=1`; configuration and alerts validated |
| Grafana | All 3 dashboards provisioned in **Torob Rent** (15 health, 12 product, 8 economics panels); all 20 SQL panels queried through the real Grafana datasource successfully |
| Browser journey | Owner draft/review, Persian prices, publish/pause locally; public search → compare → request → owner acceptance → handoff → return persisted successfully |
| Responsive | RTL inspected at 390×844 and desktop 1440×900; phone cards use one column; no horizontal page overflow; comparison scroll stays inside its container |

Public browser rental `f3737d23…` completed with simulated rental value 2,550,000 toman, separate 35,000,000 toman deposit and 127,500 toman estimated commission. Those actual persisted **demo** outcomes appeared through Grafana queries. The reporting role exposes no raw user/session/booking records. [Deployed monitoring query evidence](evidence/deployed-monitoring.json).

A second complete public browser journey (`ce5a43f8…`, 1,770,000 toman rental) verified search → comparison → view → request → acceptance → handoff → completion attribution after the navigation fix. The final captured dashboards showed 4,320,000 toman **simulated** completed GMV, 216,000 toman estimated commission, and one completed attributed search cohort among 11 searches. No business outcome was inserted directly for presentation. Subsequent visitors can naturally change these counts. [Database permissions/cohort checks](evidence/database-checks.txt).

Defects discovered and fixed during validation:

- Windows local PostgreSQL initially used a legacy encoding; initialized a UTF-8 database for Persian data.
- Invalid manually entered Jalali dates now invalidate the parent field rather than silently retaining the previous valid value.
- Arvan inherited static-extension caching ignored private media caching intent. Authenticated media now uses extensionless URLs and no-store headers; migration 003 retires old media links. New public-route isolation and pause-revocation tests pass. A few **public stock-image copies used only for QA** may remain cached at retired `.webp` URLs until CDN expiry/purge; no user-uploaded private source material was used there. The CDN control panel timed out; no unrelated CDN rule was modified.
- Grafana median-response SQL now quotes the reserved `window` column name; all datasource queries pass.
- Search attribution survives full-page navigation using per-tab session storage; server still validates every attribution against user/workspace.

Remaining limits: live model is unconfigured (malformed/schema/timeout behavior tested using controlled mock responses); no payment/escrow/identity verification; public TLS terminates at Arvan and the CDN-to-origin hop remains HTTP on the supplied origin port 80. Origin certificate issuance was attempted but ACME connection timed out. No automatic off-server backup, demo retention deletion, password recovery or load/penetration test is claimed. No external alert test notification was sent.
