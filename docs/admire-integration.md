# Admire automatic donation feed

Successful Banquest payments can be copied into Admire as already-billed credit-card
donations. Admire's documentation calls these endpoints "webhooks," although this
application sends the request to Admire after Banquest confirms the charge.

## Office setup

1. In Admire, open **Imports**.
2. Open **Automated Feeds Active** and choose **Donations**.
3. Create a Donation Feed for the High Holidays campaign.
4. Configure account matching, pledge creation, the campaign, and the Credit Card
   payment method in Admire.
5. Generate the feed token and provide it securely to the developer.

Store that token in Cloudflare as the secret `ADMIRE_DONATION_FEED_API_KEY`. Do not
put it in GitHub or a browser-visible environment variable.

The Banquest webhook then posts each successful charge to
`POST https://services.admirepro.app/api/Webhooks/externalDonation` using the
`X-API-KEY` header. The Banquest payment ID is sent as `externalRecordID`, and the
application keeps its own completion marker so webhook replays do not create a
second Admire import.

Admire import failures cause the Banquest webhook request to fail so Banquest can
retry it. The payment remains sold locally because the card was already charged.
Refunds and chargebacks still need office review in Admire; the published Admire
API does not expose a corresponding reversal endpoint.
