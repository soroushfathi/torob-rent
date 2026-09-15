# Torob Rent / ترب اجاره

### Rent the equipment you need—without buying it for a short-term job.

Torob Rent is an independent product prototype for discovering, comparing, and renting equipment. The first use case is simple: finding a suitable MacBook in Tehran for a short editing project.

<p>
  <a href="https://torob-rent.xdo-run.ir"><strong>Try the live prototype →</strong></a>
  &nbsp;·&nbsp;
  <a href="https://drive.google.com/file/d/1-IcG8VHDeTFZvfL6GRQhJX3RYGUus-cL/view">Watch the demo</a>
  &nbsp;·&nbsp;
  <a href="https://docs.google.com/presentation/d/1gJVFulfV0j18XUsSdN8LsgQy4IOhug37V1kQ8Bm0BXQ/present?slide=id.p1">View the pitch</a>
</p>

> This is an independent hiring-challenge prototype, not an official Torob service. Its personas, offers, and payments are simulated.

## See it in action

<table>
  <tr>
    <td width="50%" align="center">
      <a href="https://drive.google.com/file/d/1-IcG8VHDeTFZvfL6GRQhJX3RYGUus-cL/view">
        <img src="docs/media/demo-video.svg" alt="Watch the Torob Rent product demo" width="100%" />
      </a>
      <br />
      <strong>Product demo</strong>
      <br />
      <sub>Follow the renter and owner journey from search to return.</sub>
      <br /><br />
      <a href="https://drive.google.com/file/d/1-IcG8VHDeTFZvfL6GRQhJX3RYGUus-cL/view"><strong>▶ Watch the video</strong></a>
    </td>
    <td width="50%" align="center">
      <a href="https://docs.google.com/presentation/d/1gJVFulfV0j18XUsSdN8LsgQy4IOhug37V1kQ8Bm0BXQ/present?slide=id.p1">
        <img src="docs/media/pitch-deck.svg" alt="Open the Torob Rent early prototype pitch deck" width="100%" />
      </a>
      <br />
      <strong>Early prototype pitch</strong>
      <br />
      <sub>Explore the problem, product thesis, and path to validation.</sub>
      <br /><br />
      <a href="https://docs.google.com/presentation/d/1gJVFulfV0j18XUsSdN8LsgQy4IOhug37V1kQ8Bm0BXQ/present?slide=id.p1"><strong>▣ Open the slides</strong></a>
    </td>
  </tr>
</table>

## The product idea

Many people need expensive equipment for a project, a trip, or a weekend—not forever. Buying it can be hard to justify, while existing rental experiences often make comparison and trust difficult.

Torob Rent explores a more transparent experience:

- Describe what you need in everyday Persian.
- Compare offers by total rental cost, refundable deposit, specifications, and conditions.
- Understand which option fits the job and why.
- Send a rental request and follow its status.
- Record the device condition during handoff and return.

The initial concept is designed around trusted groups such as companies or universities, where members can access shared equipment or rent to one another within an existing community.

## A complete rental journey

| Step | Renter experience | Owner experience |
|---|---|---|
| **Discover** | Search by need, budget, dates, and neighborhood | Publish an offer with specifications and availability |
| **Compare** | See total cost, deposit, conditions, and suitability | Present clear terms before a request is made |
| **Request** | Submit a request with a fixed quote | Accept or reject without scheduling conflicts |
| **Handoff** | Confirm accessories and device condition | Document what was delivered |
| **Return** | Complete the return with a shared record | Reconcile accessories and close the rental |

## What the prototype demonstrates

- **Natural Persian search:** understands Jalali dates and Persian or Arabic numerals, then lets the user review the extracted criteria.
- **Decision-friendly comparison:** compares up to three offers without hiding the deposit or non-cash conditions.
- **Explainable matching:** suitability guidance is based on stored specifications and visible product rules.
- **Owner tools:** create, review, publish, pause, and edit offers; manage unavailable dates and photos.
- **Rental tracking:** follows each request through acceptance, handoff, return, cancellation, or expiry.
- **Product learning:** measures the search funnel, zero-result searches, acceptance, response time, and simulated economics.
- **Safe AI fallback:** optional structured AI can interpret searches, while deterministic parsing keeps the core flow usable without it.

## Try the demo

Open the [live prototype](https://torob-rent.xdo-run.ir). Each new visitor receives a private demo workspace with 12 synthetic offers and separate renter and owner identities. Use the demo strip to switch roles and experience both sides of the marketplace.

The current version intentionally does **not** process real payments, collect identity documents, provide insurance, or guarantee listings. Live AI is not configured. Real accounts use a separate empty marketplace, so the demo inventory should not be interpreted as real supply or demand.

## What this prototype is testing

The prototype is a tool for learning, not evidence that the business model is already validated. The next useful step is a small organizational pilot focused on four questions:

1. Do people have enough temporary equipment needs to return regularly?
2. Are price, deposit, and conditions clear enough to support a request?
3. Does an existing organization provide enough trust for owners and renters?
4. Which part of the journey—supply, comparison, acceptance, or handoff—creates the most friction?

## Run it locally

Requirements: Node.js 22+ and PostgreSQL 18 with UTF-8.

```sh
npm ci
npm run db:local
npm run db:migrate
npm run dev
```

Open http://localhost:14567. Run `npm run db:local` in its own terminal, or configure an existing database using `.env.example`.

For validation:

```sh
npm run typecheck
npm run lint
npm test
npm run test:integration
npm run eval
npm run build
```

## Project notes

The application is a Persian RTL, responsive Next.js product backed by PostgreSQL. Rental quotes and terms are captured when a request is made, conflicting accepted rentals are prevented at the database level, and uploaded listing images are resized, re-encoded, and stripped of metadata.

For implementation, operations, and measurement details:

- [Deployment, backup, and rollback](docs/DEPLOYMENT.md)
- [KPI dictionary](docs/KPIS.md)
- [Test evidence](docs/TESTING.md)
- [Five-minute Persian demo guide](docs/DEMO.fa.md)
- [Image sources and rights](docs/ASSETS.md)
- [Persian AI evaluation](docs/evidence/ai-evaluation.json)

Authenticated dashboards: [health](https://grafana.foroush-yar.ir/d/torob-health), [product funnel](https://grafana.foroush-yar.ir/d/torob-product), and [simulated economics](https://grafana.foroush-yar.ir/d/torob-economics).

All demo materials are also available in the [shared Google Drive folder](https://drive.google.com/drive/folders/1ciNEOjmt7-EZactip1K3wrhLVV2AyrAf).
