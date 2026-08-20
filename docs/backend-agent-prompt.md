# Backend build prompt — Ponevez Yomim Noraim Kibbudim 5787

You are the backend agent for a kibbudim-sales platform. The UI is **complete
and verified** — it renders every screen from fixtures with zero network
calls. Your job is to build the entire backend and then perform the one
integration swap that connects the UI to it. You do not design screens, write
CSS, or alter any donor-facing copy.

## 0. Context you must load first

Read these before writing any code. They are the source of truth:

1. `contracts/types.ts` — all shared types (`Minyan`, `Occasion`, `Kibbud`,
   `KibbudState`, `KibbudStatus`, `Order`, `Pledge`, `PriceTable`, `Catalog`).
2. `contracts/api.md` — every route, request shape, response shape, and the
   single error shape `{ "error": { "code", "message" } }` with codes
   `not_found | already_taken | hold_expired | cutoff_passed | invalid_input | internal`.
3. `contracts/fixtures/catalog-5787.json` — the frozen 348-item catalog your
   calendar engine must reproduce exactly.
4. `README.md` — documents the UI's demo shims you will replace.

**The `contracts/` directory is frozen. You never edit it.** If you believe a
type or route shape is wrong, stop and escalate; do not change it to simplify
a handler. You also never add a field to a response the contract doesn't
declare.

## 1. Ownership map — hard boundaries

| Path | Owner |
|---|---|
| `app/api/**`, `lib/stripe/**`, `lib/redis/**`, `lib/calendar/**`, `scripts/` (new backend scripts) | **You** |
| `app/(site)/**`, `app/(admin)/**` (views), `components/**`, `styles/**` | UI agent — do not touch, except the four integration edits listed in §8, which are explicitly delegated to you |
| `contracts/**` | Neither agent |
| `lib/state.ts`, `lib/catalog.ts`, `lib/format.ts` | UI-owned, but §8 authorizes a specific rewrite of `lib/state.ts`'s internals (signatures stay identical) |

## 2. Stack (fixed — do not substitute)

- Next.js 15 App Router on Vercel (already scaffolded; routes go in `app/api/`).
- Stripe Checkout — card **and** US bank account (ACH debit). ACH is the
  business-preferred rail; never disable it.
- Upstash Redis (`@upstash/redis`) for holds and state.
- `@hebcal/core` + `@hebcal/leyning` for the calendar engine.
- **No database.** Sold state = Stripe records mirrored into Redis by the
  webhook. Nothing else persists.
- Merchant of record: American Friends of Ponevez Yeshiva in Israel, Inc.
  (US 501(c)(3)); Stripe account in USD.

Environment variables (create `.env.example`, never commit real values):
`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `UPSTASH_REDIS_REST_URL`,
`UPSTASH_REDIS_REST_TOKEN`, `SITE_URL`, `OFFICE_NOTIFY_EMAIL`, `ADMIN_TOKEN`.

## 3. Calendar engine — `lib/calendar/`

Pure function, no I/O:

```ts
generateCatalog(hebrewYear: number): Catalog
```

**Method.** Walk Tishrei with `il: true`. For each day carrying a kriah,
derive the aliyah count from the `fullkriyah` keys returned by
`getLeyningForHolidayKey(key, cholHaMoedDay, il)`. Generate aliyah kibbudim
from that count. A **static override table** supplies what the library cannot
know:

- Hotza'ah VeHachnasah and Hagbah VeGelilah wrap every kriah (each is ONE
  kibbud at one price — never split).
- Three Pesichas HaAron at Neilah (slugs `pesicha-1`, `pesicha-2`, `pesicha-3`).
- Maftir Yonah replaces Shlishi at Yom Kippur Mincha (structure: Hotza'ah,
  Kohen, Levi, Maftir Yonah, Hagbah — 5 items).
- Chasan Torah, Chasan Bereishis, Kol HaNearim on Simchas Torah.
- Hoshana Rabbah offered in the Ponevez Yeshiva minyan only; no other Chol
  HaMoed krios are sold.
- Shemini Atzeres / Simchas Torah are one day (Eretz Yisroel).

**Occasion slugs are frozen** (they are URL segments the UI routes on):
`rh-1`, `rh-2`, `yk-shacharis`, `yk-mincha`, `neilah`, `sukkos-1`,
`hoshana-rabbah`, `simchas-torah`. Item slugs: `hotzaah`, `kohen`, `levi`,
`shlishi`, `revii`, `chamishi`, `shishi`, `shevii`, `maftir`, `maftir-yonah`,
`hagbah`, `pesicha-1..3`, `kol-hanearim`, `chasan-torah`, `chasan-bereishis`.
Item identity: `{minyan}/{occasion}/{slug}` — stable across years.

**⚠ Simchas Torah decision already embedded in the frozen fixture:** the
build plan's totals (12 items, 57 per minyan, 348 total, $773,600 face) are
only consistent with **six** distinct sellable aliyos (Kohen–Shishi) plus Kol
HaNearim absorbing the seventh. The fixture was generated that way. Your
engine must reproduce it. This is open gabbai question #1 — if the gabbai
rules differently it is a one-line override-table edit plus a fixture
regeneration, escalated, not silently changed.

**Output.** Ten files generated at build time, `catalog-5787.json` through
`catalog-5796.json`, committed to the repo. `catalog-5787.json` must be
**byte-for-byte semantically equal** to `contracts/fixtures/catalog-5787.json`
(same items, ids, tiers, order, occasions, prices; `generatedAt` may differ).
Nothing computes the calendar at request time.

**Required snapshot test** (highest-risk component — do this first): assert
per-occasion item counts across all ten years, with the 5787 numbers
hard-coded: `rh-1: 10, rh-2: 8, yk-shacharis: 9, yk-mincha: 5, neilah: 3,
sukkos-1: 10, hoshana-rabbah: 6, simchas-torah: 12`; total 348; face values
$256,600 / $235,000 / $117,500 / $117,500 / $23,500 / $23,500 = $773,600.

**Annual human gate.** A script producing a printable diff report of next
year's generated catalog against the current year's, for gabbai sign-off.

**Cutoffs** derive from candle lighting at Bnei Brak for each occasion's erev
(hebcal `Location`), enforced **per occasion** server-side — Simchas Torah
items stay sellable after Yom Kippur has closed. The `cutoffISO` values in the
frozen fixture are placeholder approximations; your engine's computed values
are authoritative for enforcement, but you still don't edit the fixture.

## 4. Pricing resolver

```ts
priceFor(level: Level, tier: Tier): number
```

From the `prices` table in the catalog: level 1 = 3600/5000/10000, level 2 =
1800/2500/5000, level 3 = 360/500/1000 (regular/special/very-special).
**Prices are never persisted on an item and never trusted from the client.**
Every Stripe amount is resolved server-side from level × tier at session
creation.

## 5. Redis layer — `lib/redis/`

Key scheme (suggested): `hold:{kibbudId}`, `sold:{kibbudId}`,
`pledge:{pledgeId}`, `pending:{kibbudId}`.

- **Checkout hold**: `SET hold:{id} {token} NX EX 720` (12 min). The hold
  token ties the hold to the session that took it.
- **Pledge hold**: same pattern, `EX 259200` (72 h), plus a pledge record
  (JSON) and membership in a `pledges:pending` set.
- **Sold**: written only by the verified Stripe webhook (or admin pledge
  confirm). Stores the order JSON: donor, email, misheberachNames, amount,
  method, createdAt.
- **State read**: `GET /api/state/[minyan]/[occasion]` merges sold records,
  pending pledges, and live holds for the 3–12 items of that occasion
  (use `MGET`/pipeline — one round trip). Items absent from the response are
  available. Response shape exactly per `contracts/api.md`, including `asOf`
  and `cutoffISO`.
- Reconciliation job/route: on demand, list Stripe checkout sessions and
  re-mark any sold item missing from Redis (idempotent).

## 6. Routes (shapes are in `contracts/api.md` — follow them exactly)

- `POST /api/hold` → 200 `{ kibbudId, expiresAt }`, 409 `already_taken`,
  410 `cutoff_passed`. Sets a hold cookie (httpOnly) carrying the hold token.
- `POST /api/checkout` → validates the caller owns a live hold; creates a
  Stripe Checkout Session with `payment_method_types` card + `us_bank_account`,
  `metadata: { kibbudId, donorName, misheberachNames: JSON }`, amount from the
  resolver, success URL `${SITE_URL}/confirmation?item={kibbudId}&method={method}&donor={donorName}`,
  cancel URL back to the item page. Extends the hold to cover ACH processing
  (mark `pending` while an ACH payment is processing). → 200 `{ url }`.
- `POST /api/pledge` → 72-hour hold + pending record + office notification
  email. → 200 `{ pledgeId, expiresAt }`.
- `GET /api/state/[minyan]/[occasion]` → per contract.
- `POST /api/webhook/stripe` → **verify signature first**
  (`stripe.webhooks.constructEvent`, raw body). On
  `checkout.session.completed` / `payment succeeded`: mark sold, clear hold,
  persist names, send the donor confirmation email with US 501(c)(3)
  acknowledgment language ("no goods or services were provided…"). On ACH
  failure: release the hold. Idempotent — replayed events must not
  double-write.
- Admin (guard everything with `ADMIN_TOKEN` header/cookie):
  `POST /api/admin/pledge/[id]/confirm`, `POST /api/admin/pledge/[id]/release`,
  `GET /api/admin/orders.csv`, `GET /api/admin/gabbai/[minyan]/[occasion]`
  (row shape per contract: id, name, order, state, donorName,
  misheberachNames).
- Cutoff enforcement lives in `hold`, `checkout`, and `pledge` — server-side,
  from calendar-derived candle lighting, per occasion.

Pattern reference: session creation + webhook verification from
`stripe-samples/checkout-one-time-payments` (MIT). Copy the pattern, not the
cart model.

## 7. Acceptance script (before any UI wiring)

A script (`scripts/exercise-transitions.mjs` or a test) that runs against
Stripe **test mode** with no UI and exercises every transition:
available → held → sold (card), available → held → expired → available,
available → pledged → confirmed, available → pledged → released, double-hold
rejection (409), post-cutoff rejection (410), webhook replay idempotency.

## 8. Integration — the fixture-to-live swap (only after §7 passes)

The UI was built so this is the *only* integration point. Four edits, all
explicitly delegated to you; change nothing else in UI-owned files:

1. **`lib/state.ts`** — keep every exported signature (`statusMap`,
   `statusFor`, `allOrders`, `orderFor`, `pendingPledges`, `pledgeFor`,
   `soldCount`) and replace the fixture reads with live reads (server-side
   Redis/Stripe-backed reads or fetches to your own routes). Delete the
   `expiresInMinutes`/`expiresInHours` demo shims — return real absolute
   `expiresAt` values.
2. **`app/(site)/[minyan]/[occasion]/[kibbud]/page.tsx`** — replace the demo
   hold (`new Date(Date.now() + 12*60_000)`) with a real `POST /api/hold`;
   on 409/410 render the existing taken/reserved branch (already built).
3. **`components/SponsorForm.tsx`** — replace the `router.push('/confirmation…')`
   demo submit: `ach`/`card` → `POST /api/checkout` then
   `window.location = url`; `wire` → `POST /api/pledge` then route to
   `/confirmation?item=…&method=wire`. Surface contract error codes with the
   form's existing styles; do not restyle.
4. **`components/PledgeQueue.tsx`** — point Confirm/Release at
   `POST /api/admin/pledge/[id]/confirm|release` instead of local state.

Then: end-to-end run in Stripe test mode through the real UI (card + ACH +
pledge paths), then live keys and one real $1 transaction. If the swap takes
more than an afternoon, stop — the contract was underspecified; escalate.

## 9. Environment notes (this repo, this machine)

- Repo: `C:\Users\CLondinsky\Downloads\ponevez-kibbudim`. Node 24 (winget
  user install); Cylance blocks `.ps1` shims, so invoke npm as
  `node <nodedir>\node_modules\npm\bin\npm-cli.js …` and Next as
  `node node_modules\next\dist\bin\next dev -p 3110`.
- `npm run fixtures` regenerates the demo fixtures — your calendar engine
  supersedes the catalog half of that script; leave the UI demo-state half
  alone until §8.
- Terminology lint (enforce in CI or a check script): "Ponevez" never
  "Ponevezh"; "Pesichas HaAron" never "Petichas HaHeichal"; donor-facing verb
  is "Sponsor", never "Buy"/"Cart"/"Checkout" (Stripe-internal naming is
  fine). Site chrome is English; Hebrew characters belong only in
  Mi Shebeirach name fields.

## 10. Non-negotiables (repeat)

- Never edit `contracts/**`. Never change a response shape to simplify a
  handler. Never persist a price on an item. Never trust a client-sent
  amount. Webhooks are signature-verified and idempotent. Item slug
  `{minyan}/{occasion}/{slug}` is the stable identity across years.
