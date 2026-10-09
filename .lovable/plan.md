# NEXORA — 3D Link Bypass Platform

## What gets built

**Public site (/)**
- Compact navbar: NEXORA logo, API status dot (from a real health check, not assumed), Admin button.
- Hero: "One link. A thousand possibilities." with gradient type, CSS 3D abstract shapes, soft ambient glow and faint grid.
- Link input card: PASTE YOUR LINK, clear + paste buttons, validation (http/https only, trimmed, length limit, blocks javascript: etc.), BYPASS LINK button.
- Provider selector: only admin-enabled providers, each with its own gradient/icon; auto-selected when only one exists.
- Processing card: provider icon, stage text (Indonesian), big percentage, gradient bar with moving light, cancel button. Simulated progress caps at ~93% until the server returns a valid result; then 100%, short pause, result card springs in. On failure it stops — no fake result.
- Result card: SUCCESSFULLY RESOLVED badge, destination domain, original vs destination URL (wrapped, never cut), time taken, "BUKA LINK ↗" (most prominent, cyan→emerald→blue), SALIN LINK (violet→blue, toast feedback), PROSES LINK LAIN.
- Error card for: invalid URL, provider off, timeout, bad API key, bad response format, provider failure, server down, rate limit.

**Admin panel**
- /admin/login — email + password, show-password, loading/error states. No public signup.
- /admin — real stats: total/active providers, total/success/failed requests, avg response time, recent requests, 14-day activity chart. Zeros when empty.
- /admin/providers — add/edit/enable/disable/delete/reorder, name, slug, description, endpoint, method, headers, API key mode (header name / bearer / query / none), input parameter, response mapping, timeout, color/icon, last test time/status/error. "+ TAMBAH PROVIDER" modal and "TEST ENDPOINT" with result statuses (Connection successful, Authentication failed, Invalid response, Timeout, Endpoint unavailable, Configuration error).
- /admin/logs — filter by provider, status, date range; pagination; clear logs older than N days (default 30-day retention).
- /admin/settings — global API key status only (Configured / Missing), plus instructions for changing it in project secrets. The key is never shown.
- SFL provider seeded: GET https://api.theresav.eu/api/bypass/sfl, param `url`, header `x-apikey`, mapping as in the brief.

**3D design system**
- Palette from the brief as tokens; layered shadows with top highlight and darker base; hover lifts 2px, press drops ~6px and shadow shrinks (~130ms). Applied to buttons, provider cards, stat tiles, nav items, copy buttons, toggles. Respects reduced-motion. Mobile-first, no horizontal overflow, admin tables become cards on phones.

## Security
- One global key `BYPASS_API_KEY` stored as a server secret; never sent to the browser, logged, or saved in the database.
- All bypass calls go through the server; admin actions verify the admin role on the server.
- SSRF guard for provider endpoints: HTTPS only, block localhost/private/link-local/metadata IPs, DNS lookup check (DNS-over-HTTPS since the server runtime lacks Node DNS), manual redirect handling with re-validation, response size cap, timeouts.
- Rate limits stored in the database: bypass per IP, login attempts, endpoint tests.
- Logs store only hostname, status, duration and error code — no full URLs or secrets.

## Technical details
- Stack: existing TanStack Start + Lovable Cloud (Postgres + auth). Admin login uses Cloud auth (secure hashing and sessions handled there), with a separate `user_roles` table and a `has_role` function; signups disabled.
- First admin: secrets `ADMIN_BOOTSTRAP_EMAIL` / `ADMIN_BOOTSTRAP_PASSWORD`, used by a one-time setup action that only works while no admin exists.
- Tables: providers, bypass_logs, app_settings, user_roles, rate_limits (with grants + RLS; public can read only safe provider fields through a server function).
- Server functions: listProviders, bypass, health; admin (auth-middleware + role check): providers CRUD/reorder/test, stats, logs, clear logs, key status.
- Response mapping: dotted-path reader only (validated with zod, no eval).
- Docs: README with env vars, migrations, admin bootstrap, key setup, deployment, troubleshooting. AGENTS.md updated.
- Verify with build checks and a browser test of the bypass and admin flows.

## You will need to provide
- `BYPASS_API_KEY` (your provider API key) and the first admin email/password — requested through the secure form during the build.
