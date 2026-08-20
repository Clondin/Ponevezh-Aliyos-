# Ponevez Yeshiva — Yomim Noraim Kibbudim 5787

Donor and office application for sponsoring kibbudim. Availability, holds,
pledges, completed sponsorships, and office views use Redis-backed live state.

Online payment is credit-card only through Banquest Hosted Tokenization v0.3.
Banquest hosts the card fields, so this application never receives raw card
numbers or CVV values. Donors may also reserve a kibbud for 72 hours and arrange
a wire or check with the office.

## Run locally

```bash
npm install
copy .env.example .env.local
npm run dev
```

Open `http://localhost:3110`. Add the Banquest sandbox credentials and
tokenization key to `.env.local`. For a temporary local smoke test without
Upstash, add `ALLOW_IN_MEMORY_REDIS=true`; never enable that flag in a deployed
environment.

See [docs/banquest-setup.md](docs/banquest-setup.md) for sandbox, webhook, and
production setup. Credentials belong only in ignored local files or encrypted
deployment environment variables.

## Verify

```bash
npm run check
npm run build
```

`npm run test:live` exercises a real Banquest sandbox charge and live Upstash
state. It requires a fresh Hosted Tokenization nonce, which expires after 15
minutes.

## Structure

- `app/(site)/` — donor catalog, live availability, reservation, payment, and
  confirmation pages
- `app/(admin)/admin/` — overview, sold sponsorships, pledge queue, and printable
  gabbai sheets
- `app/api/` — holds, card charges, pledges, state, office actions, and the signed
  Banquest webhook
- `lib/banquest/` — Banquest client, Hosted Tokenization charge, webhook parsing,
  and transaction reconciliation
- `lib/redis/` — state machine and storage adapter
- `contracts/` — original frozen shared types and historical API contract

The original backend build prompt and frozen contract still describe the former
Stripe/ACH plan for historical reference. Runtime payment code now uses Banquest
credit cards only.
