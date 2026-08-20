# Banquest credit-card setup

The site uses Banquest Hosted Tokenization v0.3 for credit cards. Banquest renders
the card fields inside its own iframe and returns a nonce that expires after 15
minutes. The browser sends only that nonce, expiration date, and ZIP to this
application; raw card numbers and CVV values never reach our server.

The server uses the API source key and PIN to charge the nonce through
`POST /api/v2/transactions/charge`. The amount is always recalculated from the
server-side kibbud catalog.

## Environment variables

Copy `.env.example` to `.env.local` and set:

- `BANQUEST_ENV=sandbox`
- `BANQUEST_SOURCE_KEY` and `BANQUEST_PIN` for server-side API calls
- `BANQUEST_TOKENIZATION_KEY` (the `pk_...` key safe for the browser iframe)
- `BANQUEST_SANDBOX_AMOUNT_USD=1` while testing
- Cloudflare D1, site, admin, and email variables as described in `.env.example`

Cloudflare supplies D1 through the `DB` binding in `wrangler.jsonc`; there is no
database password to copy into the application. Apply `migrations/` locally or
remotely before starting the corresponding application environment.

Do not put the portal username/password in the application. Never expose the API
source key or PIN to browser code. `.env.local` is ignored by Git.

## Webhook setup still needed

After the site has a public HTTPS address:

1. Create an active Banquest webhook for
   `https://YOUR_DOMAIN/api/webhook/banquest`.
2. Subscribe it to transaction events, including succeeded, declined/error,
   status, void, and refund/reversal events.
3. Copy the webhook signing value to `BANQUEST_WEBHOOK_SIGNATURE`.

The webhook handler validates `X-Signature` against the untouched request body,
deduplicates event IDs, and uses `custom_fields.custom1` to match the Banquest
transaction to the local sponsorship.

## Going live

Banquest must provide production credentials and enable the source key's credit
card Charge permission. Replace all sandbox credentials, set
`BANQUEST_ENV=production`, remove the sandbox amount override, and run a small
real-card transaction followed by a refund. Sandbox transactions cannot be moved
to production.

Run `npm run check` before deploying. `npm run test:live` additionally requires a
fresh Banquest nonce and a configured Cloudflare D1 database; nonces expire after 15
minutes.
