# Ponevez Yeshiva — Yomim Noraim Kibbudim 5787

Donor and office application for sponsoring kibbudim. Availability, holds,
pledges, completed sponsorships, and office views use Cloudflare D1-backed state.

Online payment is credit-card only through Banquest Hosted Tokenization v0.3.
Banquest hosts the card fields, so this application never receives raw card
numbers or CVV values. Donors may also reserve a kibbud for 72 hours and arrange
a wire or check with the office.

## Run locally

```bash
npm install
copy .env.example .env.local
copy .dev.vars.example .dev.vars
npm run d1:migrate:local
npm run dev
```

Open `http://localhost:3110`. Add the Banquest sandbox credentials and
tokenization key to `.env.local`. The local D1 database is created under the
ignored `.wrangler/` directory.

See [docs/banquest-setup.md](docs/banquest-setup.md) for sandbox, webhook, and
production setup. Credentials belong only in ignored local files or encrypted
deployment environment variables.

## Verify

```bash
npm run check
npm run build
```

`npm run test:live` exercises a real Banquest sandbox charge and the deployed D1
state. It requires a fresh Hosted Tokenization nonce, which expires after 15
minutes.

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
orders and Banquest references at `/admin/orders`, and run a manual Banquest
reconciliation from the overview.

Optional Cloudflare Turnstile protection uses
`NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY`; configure both or
neither. `WAVE_1_OPENS_AT` and `WAVE_2_OPENS_AT` control when each catalog wave
can be reserved. `NEXT_PUBLIC_CLOUDFLARE_ANALYTICS_TOKEN` enables the
privacy-first Web Analytics beacon. See `.env.example` for the complete list.

Donors can search all kibbudim at `/find`, build a sponsorship list of up to
ten available kibbudim, and submit one combined card payment. Dedications and
public recognition are opt-in; donor emails and Mi Shebeirach names are never
shown publicly.

## Structure

- `app/(site)/` — donor catalog, live availability, reservation, payment, and
  confirmation pages
- `app/(admin)/admin/` — overview, sold sponsorships, pledge queue, and printable
  gabbai sheets
- `app/api/` — holds, card charges, pledges, state, office actions, and the signed
  Banquest webhook
- `lib/banquest/` — Banquest client, Hosted Tokenization charge, webhook parsing,
  and transaction reconciliation
- `lib/storage/` — state machine plus D1 and deterministic test adapters
- `contracts/` — original frozen shared types and historical API contract

The original backend build prompt and frozen contract still describe the former
Stripe/ACH plan for historical reference. Runtime payment code now uses Banquest
credit cards only.
