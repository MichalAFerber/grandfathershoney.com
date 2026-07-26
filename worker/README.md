# Contact-form relay (Cloudflare Worker)

Receives submissions from the contact form on
[grandfathershoney.com](https://grandfathershoney.com), verifies Cloudflare
Turnstile server-side, and relays the message through the **Forward Email REST
API** (`POST https://api.forwardemail.net/v1/emails`) per TGWAB Dev Standards
§6/§7. Forward Email builds the MIME, so the worker no longer hand-rolls SMTP
over `cloudflare:sockets`.

The mail matches the standard contact-form format:

- **From:** `Grandfather's Honey <noreply@grandfathershoney.com>`
- **To:** `michal@grandfathershoney.com`
- **Reply-To:** the submitter's email
- **Subject:** `Grandfather's Honey⎯<subject>`
- **Body:** HTML — `Name:`/`Email:` lines (tab after the labels), blank line,
  then the message, wrapped in `white-space:pre`. All user values are
  HTML-escaped, and email/subject are stripped of CR/LF (header injection).

## Endpoints

| Method | Path       | Purpose                          |
| ------ | ---------- | -------------------------------- |
| POST   | `/contact` | JSON `{name, email, subject, message, token}` |
| GET    | `/health`  | Liveness check                   |

Responses are JSON: `{"ok":true}` or `{"ok":false,"error":"..."}`.
Until the secrets below are set, POSTs return
`503 {"ok":false,"error":"Contact form is not configured yet."}`.

## Deploy

From this directory, logged in to the Cloudflare account that owns the
`grandfathershoney.com` zone:

```bash
npx wrangler deploy
npx wrangler secret put FE_API_PASS      # Proton Pass: Forward Email [grandfathershoney.com]
npx wrangler secret put TURNSTILE_SECRET # Proton Pass: cloudflare/turnstile-clients
```

The `api.grandfathershoney.com` custom domain (and its DNS record) is created
automatically on first deploy.

## Prerequisites

1. **Forward Email**: the domain on a paid plan with outbound sending enabled,
   and the alias credentials for `noreply@grandfathershoney.com`. Those same
   credentials authenticate the REST API (Basic auth, `alias:password`) — the
   account-wide API token is deliberately not used, so a leak here cannot send
   as any other domain in the account. SPF/DKIM/DMARC already point at Forward
   Email.
2. **Turnstile**: a widget for `grandfathershoney.com` in the Cloudflare
   dashboard. Put the **sitekey** in `_config.yml` (`contact.turnstile_sitekey`)
   and the **secret key** in the `TURNSTILE_SECRET` worker secret. Until then,
   the site ships Cloudflare's public *always-passes* test sitekey
   (`1x00000000000000000000AA`); its matching test secret is
   `1x0000000000000000000000000000000AA`.

## Smoke test

```bash
curl https://api.grandfathershoney.com/health
curl -X POST https://api.grandfathershoney.com/contact \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","email":"test@example.com","subject":"Hello","message":"Smoke test","token":"XXXX.DUMMY.TOKEN.XXXX"}'
```

(The dummy token only passes while the Turnstile test keys are in place.)
