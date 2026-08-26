# `ponevez.com/high-holidays` production cutover

This checklist preserves the existing IONOS website and mail services while
Cloudflare routes `/high-holidays*` to the kibbudim Worker and keeps
`/kibbudim*` only as a redirect for older links.

## Safety rule

Do not change the IONOS nameservers until all 27 records below exist in
Cloudflare and have been checked record-for-record. MX records, mail hosts,
DKIM, SPF, DMARC, Mailchimp, SMTP2GO, and Domain Connect records must remain
DNS-only. The root and `www` website records may be proxied so Cloudflare can
apply Worker routes while continuing to use IONOS as the origin.

## Verified IONOS zone inventory

The two long `_dep_ws_mutex` values and all MX priorities were cross-checked
against the authoritative public DNS on 2026-08-25.

| # | Type | Name | Content | Priority | Cloudflare mode |
|---:|---|---|---|---:|---|
| 1 | TXT | `_dmarc` | `v=DMARC1; p=none;` | — | DNS-only |
| 2 | CNAME | `k2._domainkey` | `dkim2.mcsv.net` | — | DNS-only |
| 3 | CNAME | `k3._domainkey` | `dkim3.mcsv.net` | — | DNS-only |
| 4 | CNAME | `_domainconnect` | `_domainconnect.ionos.com` | — | DNS-only |
| 5 | A | `@` | `74.208.236.73` | — | Proxied |
| 6 | AAAA | `@` | `2607:f1c0:100f:f000::200` | — | Proxied |
| 7 | TXT | `_dep_ws_mutex` | `79f6e55b016799bec89e1705ef867350ecc27dcf989ffc1ea4cd46ad0ecc9801_1763669216321` | — | DNS-only |
| 8 | A | `www` | `74.208.236.73` | — | Proxied |
| 9 | AAAA | `www` | `2607:f1c0:100f:f000::200` | — | Proxied |
| 10 | MX | `@` | `aspmx.l.google.com` | 1 | DNS-only |
| 11 | MX | `@` | `alt1.aspmx.l.google.com` | 5 | DNS-only |
| 12 | MX | `@` | `alt2.aspmx.l.google.com` | 5 | DNS-only |
| 13 | MX | `@` | `alt3.aspmx.l.google.com` | 10 | DNS-only |
| 14 | MX | `@` | `alt4.aspmx.l.google.com` | 10 | DNS-only |
| 15 | CNAME | `s510533._domainkey` | `dkim.smtp2go.net` | — | DNS-only |
| 16 | CNAME | `em510533` | `return.smtp2go.net` | — | DNS-only |
| 17 | CNAME | `link` | `track.smtp2go.net` | — | DNS-only |
| 18 | A | `mail` | `74.208.236.76` | — | DNS-only |
| 19 | AAAA | `mail` | `2607:f1c0:100f:f000::200` | — | DNS-only |
| 20 | TXT | `_dep_ws_mutex.mail` | `6f14523e29914fe0061dda31f67d61f9ff1366ffb97220b2f09ac2d4013f7f87_1761069350947` | — | DNS-only |
| 21 | MX | `mail` | `mx00.ionos.com` | 10 | DNS-only |
| 22 | MX | `mail` | `mx01.ionos.com` | 10 | DNS-only |
| 23 | TXT | `mail` | `v=spf1 include:_spf-us.ionos.com ~all` | — | DNS-only |
| 24 | CNAME | `s1-ionos._domainkey.mail` | `s1.dkim.ionos.com` | — | DNS-only |
| 25 | CNAME | `s2-ionos._domainkey.mail` | `s2.dkim.ionos.com` | — | DNS-only |
| 26 | CNAME | `s42582890._domainkey.mail` | `s42582890.dkim.ionos.com` | — | DNS-only |
| 27 | CNAME | `autodiscover.mail` | `adsredir.ionos.info` | — | DNS-only |

## Cutover sequence

1. Add `ponevez.com` to Cloudflare on the Free plan and allow the DNS scan.
2. Compare the scan with all 27 records above; add or correct anything missing.
3. Deploy the subpath-aware build and smoke-test its `.pages.dev/high-holidays` URL.
4. Add Worker routes for `ponevez.com/high-holidays*` and
   `www.ponevez.com/high-holidays*`.
5. Replace the four IONOS nameservers with the two nameservers assigned by
   Cloudflare.
6. Wait for Cloudflare to mark the zone active, then test the existing root
   website, `www`, Google Workspace mail DNS, IONOS `mail`, and every kibbudim
   page/API/admin route.
7. Update `SITE_URL`, Banquest's webhook URL, Turnstile hostnames, and any
   transactional-email links to use `https://ponevez.com/high-holidays`.

## Rollback

If the existing website or mail DNS does not match after activation, restore
the four original IONOS nameservers:

- `ns1034.ui-dns.biz`
- `ns1100.ui-dns.de`
- `ns1069.ui-dns.com`
- `ns1040.ui-dns.org`

DNS rollback does not reverse transactions already made through Banquest.
