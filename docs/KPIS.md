# KPI dictionary

Business source of truth: PostgreSQL bookings and durable events, never in-process counters. Reporting role `torob_reporting` can select only five aggregate views. Grafana requires its existing authentication. No personal data, raw prompts or high-cardinality identifiers appear in Prometheus labels or reporting views.

The business dashboards default to **last 7 days, mode=demo**. The explicit selector separates `demo`, `real`, `test`; `real` describes account mode, not actual payments. All payments in every mode remain simulated. Time buckets are local midnight Asia/Tehran. Select whole days for exact daily comparisons; a partial first/last day is not prorated. Later outcomes backfill the cohort's initiating day, so recent cohorts are immature.

| Measure | Numerator / value | Denominator | Window / exclusions |
|---|---|---|---|
| Search sessions | One validated server search execution | None | Initiating-search day; invalid requests excluded; a fresh execution is a new cohort |
| Zero-result rate | Search cohorts with zero eligible offers | All search cohorts | Same initiating-search window and mode |
| Search → view / compare / request / accepted / completed | Distinct search cohorts with at least one attributed outcome | All initiating search cohorts | Same search IDs, counted once per stage; direct visits without a search are excluded from conversion but retained in event totals |
| Listing views | Successful listing-view events | None | Event date; fresh visits can count again; duplicate event keys do not |
| Comparison usage | Comparison events for up to 3 accessible offers | None | Event date; cohort conversion counts a search at most once |
| Booking requests | Distinct durable requests | None | Request date; retry key uniqueness prevents duplicate booking creation |
| Accepted/rejected/handoff/completed | Distinct bookings with corresponding outcome | None | Request-date cohort; ever-accepted includes later cancellations, handoff includes completed |
| Cancellation rate | Requested bookings now cancelled | All bookings requested in the selected cohort | Same request-date window; expires/rejections are separate |
| Owner activation | First published listing event per workspace/user | None (count, not activation rate) | Activation event date; preloaded seed inventory excluded |
| Median owner response | Exact median of seconds from request to first accept/reject | Responded bookings | **Fixed rolling 7 days by response timestamp**, irrespective of dashboard range; pending and non-response cancellations/expirations excluded |
| Requested booking value | Sum of immutable rental quotes | None | Request-date cohort including rejected/cancelled; deposits excluded |
| Accepted booking value | Sum of rental quotes ever accepted | None | Same request-date cohort; gross value includes later cancellations |
| Completed rental GMV | Sum of completed rental totals | None | Completion-date window; deposits excluded; not revenue |
| Average completed booking | Completed GMV | Completed rental count | Same completion-date window; unavailable with no completed rentals |
| Estimated commission | Sum of snapshotted `floor(rental × feeBps / 10000)` | None | Completion-date window, default 500 bps; estimate, never collected revenue |
| Actual collections / refunds | Unavailable (`NULL`) | None | Payments not implemented; no artificial zero-valued sales claims |

Attribution is validated against the authenticated user and workspace. Owner status transitions retain the booking's renter-search attribution. Seed operations create no analytics activity. Every booking transition uses `bookingId:status`; first publication uses `activation:userId`; unique workspace/event keys make retry writes idempotent. A conversion rate is never calculated by dividing unrelated event totals.

Technical metrics use bounded route, method, status class, pool state and provider outcome labels. API p50/p95 use Prometheus histograms over a 5-minute rate window. Database probe latency is specifically `SELECT 1`, not all query latency. AI latency/token/fallback counts use durable rolling 24-hour aggregates; cost is present only with configured token pricing. Process resources describe the Node process; container-wide memory/CPU accounting is not claimed.

Alerts: scrape down for 2 minutes; DB readiness zero for 2 minutes; API 5xx fraction above 5% with more than 20 requests in the last 5 minutes, sustained 5 minutes. Probe and metrics requests are excluded from the API error ratio. Alert rules were validated; no test notification was sent and existing notification routing was preserved.
