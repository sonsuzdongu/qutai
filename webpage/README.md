# Qutai website

The marketing site for Qutai: one long page in English (`/en/`) and Turkish (`/tr/`), written in React and
prerendered to static HTML at build time, then hydrated. It is served by Cloudflare Workers static assets; a
small Worker answers only `/`, sending visitors to their language.

It is a separate project from the app: its own `package.json`, lockfile, TypeScript and ESLint config. The app's
root `tsconfig.json`, `eslint.config.js` and `metro.config.js` ignore this folder.

## Commands

Node 22.12 or later.

```bash
npm install
npm run dev        # Vite dev server (client-rendered, no language redirect): http://localhost:5173/
npm run build      # typecheck, client + server builds, prerender into dist/client
npm run preview    # build, then `wrangler dev`: the real Worker and static assets on http://localhost:8787
npm run check      # after a build: the pages' head tags, JSON-LD, no third-party loads, the language rules
npm run lint
npm run typecheck  # site and Worker
npm run assets     # regenerate the images in public/ from ../assets (logo, icons, social previews)
npm run art        # size the miniatures in art-src/ into src/art/ (see ART.md)
npm run deploy     # build, then `wrangler deploy` (asks you to log in to Cloudflare the first time)
```

## Before the first deploy

1. Set the site's address in `src/lib/site.ts` (`SITE_URL`). Canonical links, `hreflang`, the sitemap and the
   social preview images use it; the build warns while it is the `.example` placeholder.
2. In `wrangler.jsonc`, keep or change the Worker's `name`, and add the domain under `routes` once it is on
   Cloudflare (or attach it in the dashboard).
3. `npm run deploy`. Nothing else is needed: no environment variables, no KV, no secrets.

## How it is put together

| Path | What it is |
|---|---|
| `src/App.tsx`, `src/components/` | The page: header, hero with the main miniature, the statement with the phone mock, scenarios, memory, privacy, browser, comparison, getting started, open source, status, footer |
| `ART.md`, `art-src/`, `src/art/` | The robot miniatures: prompts and how to add them; originals (not committed) and the sized WebP files the page uses. A missing painting shows a placeholder |
| `src/i18n/en.ts`, `src/i18n/tr.ts` | All copy. Same keys in both (TypeScript fails the build otherwise). Lines marked `app:` are the app's own UI strings |
| `src/data/comparison.ts` | The comparison table: rows, Qutai's column, every competitor cell with its source and date |
| `src/lib/motion.ts` | Parallax and reveals: transform/opacity only, off under `prefers-reduced-motion` |
| `src/entry-server.tsx`, `src/main.tsx` | Prerender entry and the browser entry (loads only the page language's strings, then hydrates) |
| `scripts/prerender.mjs` | Writes `en/index.html`, `tr/index.html` with their head tags and JSON-LD, `404.html`, `robots.txt`, `sitemap.xml`, `_headers` |
| `scripts/make-assets.mjs` | Builds `public/` images from the app's `assets/` |
| `worker/` | The Worker: `/` → `/en/` or `/tr/`; `/intent/sign-in/email` (below) |

### Language

`/` is the only path that runs code (`run_worker_first: ["/"]`). It redirects (302, `Vary: Accept-Language,
Cookie`, not cached) by, in order: the `lang` cookie, which the language switch on the page sets; the first
Turkish or English entry of `Accept-Language` by preference (`tr`, `tr-TR` → Turkish; other languages are
skipped); English. Everything else is a static file. `/en` redirects to `/en/` (Cloudflare's
`auto-trailing-slash`); unknown paths get `404.html`.

### The sign-in email's link

`/intent/sign-in/email?token=…` (`worker/intent.ts`, run by the Worker: `run_worker_first` includes `/intent/*`) is
where the app's sign-in email links (the API's `MAIL_INTENT_DOMAIN`), because mail apps such as Gmail don't make a
`qutai://` link tappable. The page opens the app: `<SCHEME>://sign-in/email?token=…`, on Android as an `intent://`
URL with `ANDROID_PACKAGE` (Chrome then opens that app, or its store page when it is missing, and comes back here
marked `tried=1` so it doesn't loop). On a phone it tries once by itself and always shows an "Open Qutai" button; on a
computer it explains that the link is for the phone. In the app's ten languages, from `Accept-Language` (the `lang`
cookie first for English and Turkish).

`SCHEME` (`qutai`) and `ANDROID_PACKAGE` (`com.sonsuzdongu.qutai`) are `vars` in `wrangler.jsonc`; for `wrangler dev`
they can be overridden in `.dev.vars`. The token is a single-use sign-in secret, so the page signs nothing in and
calls nothing (a mail scanner opening it uses nothing up), loads only the site's own icon, removes the token from the
address bar and history entry once loaded, and answers with `Cache-Control: no-store`, `Referrer-Policy: no-referrer`,
`X-Robots-Tag: noindex` and its own Content-Security-Policy (a nonce for its inline style and script). The Worker logs
nothing (observability is off). A token that isn't one answers 400 with "This link is incomplete".

### Privacy of the site itself

The pages load nothing from other origins (no fonts, analytics or CDNs) and the Content-Security-Policy in
`_headers` allows only the site's own origin. The only cookie is `lang`, set when a visitor uses the language
switch. `npm run check` fails if a built page loads anything from elsewhere.

## Updating the comparison

`src/data/comparison.ts` is the single source for both languages: facts (state, source URL, date checked) are
shared; row labels and notes have `en` and `tr`.

- **Qutai's column** (`QUTAI`) follows the code and the owner's checklist (`checklist.md` at the repository root).
  When a feature lands or changes there, change the cell's `state` (`yes`, `partial`, `no`) and its note. Keep it
  honest: features that are missing stay `no` (sync, desktop, store release today).
- **Competitor cells** must come from the vendor's own current pages about the mobile app (feature pages, help
  centre, pricing, App Store / Google Play listing). Put the URL in `source` and the day you read it in
  `checked`. Only the mobile app counts: a feature that exists only on desktop is `no`, with a note. If no such
  page settles it, use `unknown`: it is shown as "Not confirmed", never as "No". Notes are your own words, never copied text.
- When you re-check the table, update `CHECKED` (the "Last checked" date on the page).
- A competitor that has no mobile browser or is shutting down goes in `EXCLUDED` with the reason, not in the table.
- Rows: keep the table to about 16. Add a row in `GROUPS` and a cell for it in every product (TypeScript checks
  that each product has every row).

Product names are trademarks of their owners; the page names them in plain text only, without logos or brand
colours, and links "Report a correction" to the repository's issues.
