# API Contract — FROZEN

Neither agent edits this file. A change here is escalated, not made.

All routes are JSON. All errors share one shape:

```json
{ "error": { "code": "string", "message": "string" } }
```

Error codes: `not_found`, `already_taken`, `hold_expired`, `cutoff_passed`,
`invalid_input`, `internal`.

---

## GET /api/state/[minyan]/[occasion]

Returns the live state of every kibbud in one occasion of one minyan.
Items not listed are `available`.

**200**
```json
{
  "minyan": "grodna",
  "occasion": "yk-mincha",
  "asOf": "2026-09-07T14:03:22.000Z",
  "cutoffISO": "2026-09-20T18:09:00+03:00",
  "statuses": [
    { "id": "grodna/yk-mincha/maftir-yonah", "state": "held", "expiresAt": "2026-09-07T14:12:10.000Z" },
    { "id": "grodna/yk-mincha/kohen", "state": "sold" }
  ]
}
```

## POST /api/hold

Takes a 12-minute checkout hold (`SET NX`, TTL 720s).

**Request** `{ "kibbudId": "grodna/yk-mincha/maftir-yonah" }`

**200** `{ "kibbudId": "...", "expiresAt": "2026-09-07T14:12:10.000Z" }`

**409** `already_taken` — sold, pending, or held by someone else.
**410** `cutoff_passed`.

## POST /api/checkout

Creates a Stripe Checkout session (card + ACH). Requires a live hold
owned by the caller.

**Request**
```json
{
  "kibbudId": "grodna/yk-mincha/maftir-yonah",
  "donorName": "string",
  "email": "string",
  "misheberachNames": ["string"]
}
```

**200** `{ "url": "https://checkout.stripe.com/c/pay/..." }`

**409** `already_taken` · **410** `hold_expired` or `cutoff_passed`.

## POST /api/pledge

Reserve-and-pay-by-wire. Takes the same hold with a 72-hour TTL and
writes a pending record.

**Request** — same shape as `/api/checkout` plus optional `"phone"`.

**200** `{ "pledgeId": "plg_...", "expiresAt": "2026-09-10T14:03:22.000Z" }`

**409 / 410** — as above.

---

## Admin (authenticated)

- `POST /api/admin/pledge/[id]/confirm` → `{ "ok": true }` — converts to sold.
- `POST /api/admin/pledge/[id]/release` → `{ "ok": true }` — frees the item.
- `GET /api/admin/orders.csv` — CSV export of every buyer.
- `GET /api/admin/gabbai/[minyan]/[occasion]` — gabbai sheet data:

```json
{
  "minyan": "grodna",
  "occasion": "yk-mincha",
  "rows": [
    {
      "id": "grodna/yk-mincha/kohen",
      "name": "Kohen",
      "order": 2,
      "state": "sold",
      "donorName": "string | null",
      "misheberachNames": ["string"]
    }
  ]
}
```
