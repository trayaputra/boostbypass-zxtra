<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## Architecture rules
- All provider calls go through `src/lib/bypass.server.ts` (SSRF guard + JSON path mapping); never call providers from the browser — keeps the global key server-side.
- Exactly one provider secret, `BYPASS_API_KEY`; providers only configure how it is sent — avoids per-provider secrets.
- Admin server functions must use `requireAdmin` from `src/lib/admin-middleware.ts` — route guards alone do not protect RPCs.
- DB tables are service-role only; server functions read/write via `supabaseAdmin` after validation — no client-side table access.
- Admin login runs server-side (`adminLogin`) for rate limiting and one-time bootstrap — public sign-up is disabled.
- Bypass logs store hostname/metadata only, never full URLs or secrets — privacy.
