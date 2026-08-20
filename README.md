# Ponevez Yeshiva — Yomim Noraim Kibbudim 5787 (UI)

The donor-facing and office UI for the kibbudim platform, built per the
build plan. **Every screen renders from fixtures with zero network calls** —
the backend integration point is the swap described in `contracts/api.md`.

## Run

```bash
npm install
npm run dev   # http://localhost:3110
```

`npm run fixtures` regenerates `contracts/fixtures/catalog-5787.json`
(348 items, asserted against the build-plan totals) and the UI-owned demo
state in `lib/fixtures/state-5787.json`.

## Map

- `contracts/` — frozen types, API contract, catalog fixture. Not edited by
  either agent.
- `app/(site)/` — minyan → occasion → item grid → item detail → confirmation
  / expired-hold, with loading, error, and not-found states.
- `app/(admin)/admin/` — season overview, printable gabbai sheets (A4 print
  stylesheet), pending pledge queue, sold summary by minyan.
- `lib/state.ts` — demo state layer matching the `GET /api/state` shape; the
  only file that changes at integration.

## Decisions and demo shims

- **Simchas Torah structure**: the plan's totals (12 items / 57 per minyan /
  348 / face values) are consistent with **six** distinct aliyos plus Kol
  HaNearim, so the fixture follows the totals (open item #1 — Kol HaNearim
  absorbs one aliyah). One-line change in `scripts/generate-fixtures.mjs`
  if the gabbai rules otherwise.
- Held items in the demo state carry `expiresInMinutes`, converted to an
  absolute `expiresAt` at read time so countdowns are always live.
- Opening an available item's detail page starts a demo 12-minute hold
  (in production this is `POST /api/hold`).
- Pledge confirm/release in the office queue mutate local state only.
