# Implementation plan

1. Inspect the empty repository and XDo without changing shared infrastructure.
2. Build a Persian RTL marketplace with isolated demo workspaces and server authentication.
3. Implement PostgreSQL migrations, integer toman pricing, immutable booking terms, a state machine, and an exclusion constraint for concurrent reservations.
4. Implement validated need parsing and listing drafting, with a clearly labeled deterministic fallback and optional server-only model provider.
5. Complete owner/renter journeys, validated persistent media, comparison, and condition reports.
6. Test rules, concurrency, permissions, Persian inputs, provider failures, and desktop/mobile browser journeys.
7. Deploy an isolated service on XDo; integrate existing monitoring only after inspecting it; verify persistence, metrics, and actual demo events.

Visual direction: a crisp equipment marketplace, ink on white with restrained Torob-red accents, Persian typography, a compact task-focused search panel, photographic catalog cards, and a persistent comparison tray. Independent prototype and simulated inventory/payment labels are always visible.

The requested Next.js/PostgreSQL/SSH deployment takes precedence over the Sites skill's Cloudflare-specific starter and hosting defaults. No Sites service or second remote is created.
