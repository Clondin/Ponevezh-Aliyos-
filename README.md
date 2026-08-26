# Ponevez Yeshiva — Yomim Noraim Kibbudim 5787

Donor and office application for sponsoring kibbudim. Availability, holds,
pledges, completed sponsorships, and office views use Cloudflare D1-backed state.

Online card payments use Banquest Hosted Tokenization. Banquest renders the card
fields and gives the application a short-lived nonce, so raw card numbers and CVV
values never reach this server. Approved payments immediately mark the selected
kibbudim sponsored; ambiguous gateway responses remain reserved for reconciliation.

## Run locally

```bash
npm install
copy .env.example .env.local
copy .dev.vars.example .dev.vars
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
signed webhooks, office confirmation, and state transitions without charging a
real card.

## Deploy to Cloudflare

`wrangler.jsonc` binds the Worker to the `ponevez-kibbudim` D1 database. Apply
the remote migration with `npm run d1:migrate:remote`, set deployment secrets in
Cloudflare, and build/deploy with `npm run deploy` from Linux or Cloudflare's
Git integration. OpenNext recommends Linux or WSL; native Windows builds emit a
compatibility warning even when they complete successfully.

Set `ADMIN_TOKEN` before using `/admin`. The office login asks only for this
password and creates a secure, HTTP-only 12-hour session cookie. If it is not
configured, the office pages return 404 and donor information remains hidden.

Every completed payment creates a donor receipt and an office sale notification.
Set `OFFICE_NOTIFY_EMAIL`, `RESEND_API_KEY`, and `EMAIL_FROM` (on a verified
sender domain) to deliver them. Without a configured transport, the messages are
kept in the D1 email outbox so a payment notification is not silently lost.
The office can inspect and retry queued messages at `/admin/email`, search
orders and Banquest references at `/admin/orders`. Ambiguous Banquest responses
can be resolved through the signed webhook or reconciliation. The pledge queue
remains available for older office-arranged and Admire reservations.

Optional Cloudflare Turnstile protection uses
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`; configure both or
neither. Both catalog waves are currently open; `WAVE_1_OPENS_AT` and
`WAVE_2_OPENS_AT` can schedule future openings. `NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN` enables the
privacy-first Web Analytics beacon. See `.env.example` for the complete list.

Donors can search all kibbudim at `/find`, build a sponsorship list of up to
ten available kibbudim, and submit one combined Banquest payment. Dedications and
public recognition are opt-in; donor emails and Mi Shebeirach names are never
shown publicly.

## Structure

- `app/(site)/` — donor catalog, live availability, reservation, payment, and
  confirmation pages
- `app/(admin)/admin/` — overview, sold sponsorships, pledge queue, and printable
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
