# NEXORA — 3D Link Bypass Platform

Multi-provider shortlink resolver with an admin panel. Built on TanStack Start + Lovable Cloud (Postgres + auth).

## Environment variables (server secrets)

| Name | Purpose |
| --- | --- |
| `BYPASS_API_KEY` | The single global provider API key. Never sent to the browser or stored in the DB. |
| `ADMIN_BOOTSTRAP_EMAIL` | Email of the first admin. |
| `ADMIN_BOOTSTRAP_PASSWORD` | Password of the first admin (min. 10 chars). |

Supabase URL/keys are injected automatically by Lovable Cloud. See `.env.example`.

## First admin (bootstrap)

1. Set the two `ADMIN_BOOTSTRAP_*` secrets.
2. Open `/admin/login` and sign in with exactly those values.
3. While **no admin exists**, the server creates that user and grants the `admin` role. After that, bootstrap is disabled permanently. Public sign-up is turned off.

## Global API key

All providers share `BYPASS_API_KEY`. Per provider you only choose *how* it is sent: custom header (e.g. `x-apikey`), `Authorization: Bearer`, query parameter, or none. To rotate: update the secret in Lovable → Cloud → Secrets, then re-publish. The admin Settings page shows only Configured / Missing.

## Database

Migrations live in `drizzle/migrations/` and are applied with Lovable's migration tool. Tables: `providers`, `bypass_logs`, `app_settings`, `user_roles`, `rate_limits`. All tables are RLS-locked; the server accesses them after verifying the caller.

## Architecture

- Browser → server function `runBypass` → validate URL → rate limit (15/min/IP) → load provider → SSRF checks → call provider with the global key → map response via dotted JSON paths → validate destination → return.
- Admin server functions use `requireAdmin` (verified token + `has_role` on the server).
- SSRF guard: HTTPS only, ports 443/8443, blocks localhost/private/link-local/metadata, DNS-over-HTTPS resolution check, manual redirects (max 3, same host, re-validated), 1 MB response cap, timeouts.
- Logs store provider, status, duration, error code and input hostname only.

## Local development

```
bun install
bun run dev
```

## Deployment

Publish from Lovable. Secrets are carried into the published app; after changing a secret, publish again.

## Troubleshooting

- **CORS**: not applicable — the browser never calls providers directly.
- **Timeout**: raise the provider timeout (max 60 s) in the provider form; check provider status with TEST ENDPOINT.
- **Authentication failed**: verify `BYPASS_API_KEY` and the header name for that provider.
- **Invalid response**: adjust the response mapping (`destinationPath` etc.) to match the provider JSON.
- **Configuration error**: endpoint must be public HTTPS; private/internal hosts are rejected.
