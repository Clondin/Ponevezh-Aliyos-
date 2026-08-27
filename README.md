# Ponevez Yeshiva — Yomim Noraim Kibbudim 5787

Donor and office application for sponsoring kibbudim. Availability, holds,
completed sponsorships, and office views use Cloudflare D1-backed state.

Online card payments use Banquest Hosted Tokenization. Banquest renders the card
fields and gives the application a short-lived nonce, so raw card numbers and CVV
values never reach this server. Approved payments immediately mark the selected
kibbudim sponsored; ambiguous gateway responses remain reserved for reconciliation.

## Run locally

```bash
npm install
cp .env.example .env.local
cp .dev.vars.example .dev.vars
npm run d1:migrate:local
npm run dev
```

Open `http://localhost:3110/high-holidays`. Add Banquest sandbox credentials to
the ignored `.env.local` file. The local D1 database is created under the ignored
`.wrangler/` directory. See `docs/banquest-setup.md` for test-card and webhook setup.

## Verify

```bash
npm run check
npm run build
```

The test suite verifies single and combined Banquest payments, concurrency,
signed webhooks, Admire synchronization, and state transitions without charging a
real card.

## Deploy to Cloudflare

`wrangler.jsonc` binds the Worker to the `ponevez-kibbudim` D1 database. Apply
the remote migration with `npm run d1:migrate:remote`, set deployment secrets in
Cloudflare, and build/deploy with `npm run deploy` from Linux or Cloudflare's
Git integration. OpenNext recommends Linux or WSL; native Windows builds emit a
compatibility warning even when they complete successfully.

Pushes to `main` deploy through `.github/workflows/deploy.yml` after the
repository secret `CLOUDFLARE_API_TOKEN` is added with Workers Scripts and D1
edit access. The Cloudflare account ID is not secret and is already configured
in the workflow.

Set `ADMIN_TOKEN`, `ADMIN_SESSION_SECRET`, and `ADMIN_API_TOKEN` before using
`/admin`. The office login asks only for the password and creates a secure,
HTTP-only four-hour session cookie. The API token is separate and is used by
scheduled maintenance and command-line scripts.

Every completed payment is durably queued for Admire, where the official donor
receipt and office record are created. The same queue is used after an immediate
approval, a signed webhook, or reconciliation; scheduled maintenance retries
failed handoffs. The office can search orders and Banquest references at
`/admin/orders`. The legacy payment-review queue remains only for reservations
that existed before direct Banquest checkout launched.

Production Cloudflare Turnstile protection uses `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
and `TURNSTILE_SECRET_KEY`; configure both. Both catalog waves are currently open; `WAVE_1_OPENS_AT` and
`WAVE_2_OPENS_AT` can schedule future openings. `NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN` enables the
privacy-first Web Analytics beacon. See `.env.example` for the complete list.

Donors can search all kibbudim at `/find`, build a sponsorship list of up to
ten available kibbudim, and submit one combined Banquest payment. Dedications are
optional; donor emails and Mi Shebeirach names are never
shown publicly.

## Structure

- `app/(site)/` — donor catalog, live availability, reservation, payment, and
  confirmation pages
- `app/(admin)/admin/` — overview, sponsorship history, legacy review queue, and printable
  gabbai sheets
- `app/api/` — holds, checkout, state, signed webhooks, and office actions
- `lib/banquest/` — active Banquest charge, webhook, and reconciliation code
- `lib/storage/` — state machine plus D1 and deterministic test adapters
- `contracts/` — original frozen shared types and historical API contract

The original backend build prompt and frozen contract describe earlier payment
plans for historical reference. Runtime buyer payments use Banquest.

The current 5787 inventory includes the Israeli office corrections recorded in
`docs/office-corrections-5787.md`; generated catalogs are the runtime source of
truth.
