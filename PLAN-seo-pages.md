# Plan — Static SEO Landing Pages for Bay Noise

> Status: Ready for implementation · Last updated 2026-08-26
> Review: Passed adversarial review (2 critical, 3 high, 5 medium findings — all addressed below)

## 1. Overview / Problem Statement

**Goal (one sentence):** Generate static, crawler-friendly HTML "billboard" pages for every venue, artist, and city that has upcoming shows, so Bay Noise regains SEO discoverability it lost when it pivoted from Astro to a client-rendered Vite + Preact SPA on Cloudflare Pages.

Bay Noise is a single-page app with no router. After the Astro → Preact migration, the only indexable URL is the homepage (`/`), and `sitemap.xml` lists just that one URL. Search engines see an empty `<div id="app">` and a JSON-LD blob injected by JS, so individual venues, artists, and cities are invisible to crawlers.

The fix is a **build-time** script that reads the pipeline output (`public/shows.json`, `public/known-venues.json`) and writes self-contained static HTML files into `dist/` after `vite build` runs. Each page shows just enough content (upcoming shows, structured data) to rank and to funnel humans back into the SPA via a CTA link. No JavaScript, no framework runtime, no Tailwind — just inline-styled HTML.

**Scope of output (measured against current data, `today = 2026-08-26`):**

| Entity | Pages | Notes |
|---|---|---|
| Venues | 137 | 0 slug collisions |
| Artists | ~2,371 | 5 raw collisions, all case-variant dups → resolved by lowercase grouping |
| Cities | 34 | 0 slug collisions |
| Sitemap | 1 | ~2,542 URLs, well under Google's 50,000 / 50MB limits |
| Total files | ~2,545 | Well under Cloudflare Pages' 20,000-file deployment limit |

---

## 2. Architecture Decisions

### 2.1 Build-time generation, not runtime SSR
Pages are generated once at build by a TypeScript script invoked from `npm run build`, after `vite build` writes `dist/`. No Cloudflare Pages Function, no SSR server, no hydration. Rationale: the data already exists as JSON; static files are cheapest to serve, fastest for crawlers, and require zero runtime cost.

### 2.2 Pure logic in `scripts/seo/*`, I/O in the orchestrator
The generator is split into **side-effect-free pure modules** (`scripts/seo/extract.ts`, `templates.ts`, `sitemap.ts`) and a thin **orchestrator** (`scripts/build-seo-pages.ts`) that does only file reads + writes. This is required for testability: `scripts/build-data.ts` calls `main()` at module top level, so importing it runs the whole pipeline — we must not repeat that. Pure modules export functions only; the orchestrator is the sole file with a top-level `main().catch(...)`.

### 2.3 Shared `slugify` extracted to `src/lib/slug.ts`
The spec requires the slug function to match `src/components/add-to-calendar.tsx`. That function is currently local/non-exported. We extract it verbatim to `src/lib/slug.ts` and import it from both `add-to-calendar.tsx` and the SEO modules. This is a behavior-preserving refactor (bundle size unchanged) and guarantees consistency by construction rather than by copy-paste.

### 2.4 Group entities by lowercase name; canonical casing from artist-cache or alphabetical
All 5 artist slug collisions are case-variant duplicates of the same act (`"JT"`/`"Jt"`, `"Painscale"`/`"painscale"`, `"Right to Remain"`/`"Right To Remain"`, `"Yes Ma'am"`/`"Yes Ma'aM"`, `"ARPH"`/`"Arph"`). Grouping artists by `name.toLowerCase()` eliminates collisions and dedupes the data.

**Canonical casing** must be deterministic across pipeline runs (non-deterministic casing = new slug each run = orphaned URLs + 404s). Strategy:
- **Artists**: if the artist exists in `artist-cache.json`, use the Spotify-canonical name from the cache entry. Otherwise, use alphabetical order of the lowercase-grouped variants.
- **Venues**: look up each `v.name` against `known-venues.json` using the existing `matchVenue()` logic. Use the **canonical** `known-venues.json` name (not the raw scraped string). This also fixes the slug mismatch where scraped aliases like "Bottom of the Hill, S.F." would produce `bottom-of-the-hill-s-f` instead of `bottom-of-the-hill`.
- **Cities**: use the canonical city name from `CITY_MAP` values (already in `build-data.ts`), or alphabetical order.

The orchestrator must also check for post-slugify collisions (two entities producing the same slug after the 60-char cap) and skip duplicates with a warning.

### 2.5 Inline CSS via global CSP `style-src` update
The site-wide CSP in `public/_headers` has `style-src 'self'` with no `'unsafe-inline'`, which blocks inline `<style>` on the SEO pages. Cloudflare Pages `_headers` **appends** headers from matching rules — it does not replace them. Adding a path-specific `Content-Security-Policy` header results in **two** CSP headers, and browsers intersect them (the stricter policy wins). So a path-specific `style-src 'unsafe-inline'` would be intersected with the global `style-src 'self'`, and inline styles would still be blocked.

**Fix**: update the global CSP's `style-src` from `'self'` to `'self' 'unsafe-inline'`. This allows inline styles on all pages. Security impact is minimal — inline CSS cannot execute code; the main risk is content injection (phishing via styled elements), which is mitigated by `base-uri 'self'` and `default-src 'self'`. The app already allows `script-src 'self' 'unsafe-inline'`, so `'unsafe-inline'` for styles is a weaker permission than what scripts already have.

No path-specific `_headers` rules are needed. The SEO pages inherit the global CSP, which already provides `script-src 'self' 'unsafe-inline'` (needed for JSON-LD `<script type="application/ld+json">` — Chromium and Firefox treat this as inline-script-block for CSP purposes).

### 2.6 Service-worker navigateFallback denylist
`vite.config.ts` registers a Workbox `navigateFallback` to `index.html` for navigation requests, with a `navigateFallbackDenylist` that currently excludes only `.well-known`, `robots.txt`, `sitemap.xml`. The new `/venue/*`, `/artist/*`, `/city/*` paths are real static files (200), so a NetworkFirst navigation would normally serve them correctly — but on a slow/failed network the SW would fall back to the SPA. To make behavior predictable for returning users (and to guarantee crawlers-with-cached-SW see the billboard), we add the three path prefixes to `navigateFallbackDenylist`.

### 2.7 CTA links funnel to the SPA home page
The billboards link to `/` (the SPA home page). The CTA copy is "Browse all Bay Area shows →" — it does not promise filtered results, just funnels the user into the app. The SPA currently does **not** read URL query params. Making it do so is a separate, optional follow-up that changes app behavior and is out of scope for this SEO work.

### 2.8 No app-bundle bloat
No SEO module is imported by `src/app.tsx` or any component. `src/lib/slug.ts` is the only new file in `src/` and it replaces an already-bundled inline function (net bundle change ≈ 0). All template/extraction/sitemap logic lives under `scripts/seo/`, which is build-time only and never enters the client bundle.

### 2.9 Date filtering uses America/Los_Angeles "today"
Past shows are filtered with `date >= todayLocal()` where `todayLocal()` replicates the existing helper in `src/lib/filter.ts` and `functions/calendar.ics.ts` (`Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" })`). This keeps "upcoming" consistent across app, iCal function, and SEO pages.

### 2.10 Caps: 50 shows/page, per-page `lastmod`, date-only JSON-LD `startDate`
Each page lists at most 50 upcoming shows (sorted ascending by date) to stay under Google's ~100KB content guidance. JSON-LD `Event.startDate` uses `YYYY-MM-DD` (date-only) for simplicity and correctness; the app's Pacific-offset time logic can be ported later if rich-result timing becomes valuable.

**Sitemap `lastmod`**: each page's `<lastmod>` uses the latest show date on that page (not the build date). Using the build date for all ~2,542 pages would signal mass updates to Google, which may lower crawl priority. Per-page lastmod = latest `show.date` on the page is more accurate and gives crawlers meaningful freshness signals.

---

## 3. File-by-File Implementation Plan

### New files

| # | File | Purpose | Subagent (tier) | Depends on | Effort |
|---|---|---|---|---|---|
| 1 | `src/lib/slug.ts` | `export function slugify(text: string): string` — verbatim extraction from `add-to-calendar.tsx` | tier-1-coder | — | S |
| 2 | `src/lib/slug.test.ts` | Unit tests for `slugify` (lowercasing, non-alnum → `-`, trim leading/trailing `-`, 60-char cap, empty input) | tier-1-coder | #1 | S |
| 3 | `scripts/seo/extract.ts` | Pure: `todayLocal()`, `extractEntities(data, knownVenues)` → `{ venues, artists, cities }` where each entity carries its capped (≤50) upcoming-show list. Venues looked up against `known-venues.json` for canonical names. Artists resolved via `artist-cache.json` for canonical casing. | tier-1.5-coder | #1 | M |
| 4 | `scripts/seo/extract.test.ts` | Tests: past-date filtering, lowercase grouping/dedup, 50-show cap, null-city handling, empty genres, venue canonical name lookup from known-venues, artist canonical casing from artist-cache | tier-1.5-coder | #3 | M |
| 5 | `scripts/seo/templates.ts` | Pure HTML builders: `buildHead()`, `buildVenuePage()`, `buildArtistPage()`, `buildCityPage()`, JSON-LD builders, shared `<style>` | tier-1.5-coder | #1 | M |
| 6 | `scripts/seo/templates.test.ts` | Tests: title/description uniqueness, canonical URL, OG/Twitter tags, JSON-LD `@type`, CTA href, 50-show cap in markup, HTML escaping | tier-1.5-coder | #5 | M |
| 7 | `scripts/seo/sitemap.ts` | Pure: `buildSitemap(entries)` → XML string; `SitemapEntry` type | tier-1-coder | — | S |
| 8 | `scripts/seo/sitemap.test.ts` | Tests: homepage priority 1.0/daily, venue/city 0.7, artist 0.6, per-page lastmod = latest show date, XML well-formed, XML escaping of URLs | tier-1-coder | #7 | S |
| 9 | `scripts/build-seo-pages.ts` | Orchestrator: read `public/shows.json` + `public/known-venues.json` + `public/artist-cache.json`, call extract/templates/sitemap, write `dist/venue/*/index.html`, `dist/artist/*/index.html`, `dist/city/*/index.html`, `dist/sitemap.xml`; log counts; check for slug collisions and skip with warning | tier-1.5-coder | #3,#5,#7 | M |

### Edited files

| # | File | Change | Subagent (tier) | Depends on | Effort |
|---|---|---|---|---|---|
| 10 | `src/components/add-to-calendar.tsx` | Remove local `slugify`; `import { slugify } from "../lib/slug.js"` | tier-1-coder | #1 | S |
| 11 | `package.json` | `build` → `tsc --noEmit && vite build && npx tsx scripts/build-seo-pages.ts` | tier-1-coder | #9 | S |
| 12 | `vitest.config.ts` | Add `"scripts/**/*.test.{ts,tsx}"` to `test.include` | tier-1-coder | #2,#4,#6,#8 | S |
| 13 | `vite.config.ts` | Add `/^\/venue\//`, `/^\/artist\//`, `/^\/city\//` to `navigateFallbackDenylist` | tier-1-coder | — | S |
| 14 | `public/_headers` | Add `'unsafe-inline'` to `style-src` in the `/*` block CSP | tier-1-coder | — | S |

### Optional cleanup

| # | File | Change | Notes |
|---|---|---|---|
| 15 | `public/sitemap.xml` | Delete the static homepage-only file | Now generated into `dist/` by the script; leaving it is harmless (overwritten in `dist/`) but removing it avoids confusion. Only do this after verifying the generated sitemap works. |

---

## 4. HTML Template Design

All three page types share one shell and one inline `<style>` block; only the `<title>`, meta, JSON-LD, `<h1>`, meta line, show-list columns, and CTA href differ.

### 4.1 Shared shell

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#000000">
  <meta name="color-scheme" content="dark">
  <title>{TITLE}</title>
  <meta name="description" content="{DESCRIPTION}">
  <link rel="canonical" href="{CANONICAL_URL}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">

  <!-- Open Graph -->
  <meta property="og:title" content="{OG_TITLE}">
  <meta property="og:description" content="{DESCRIPTION}">
  <meta property="og:type" content="{OG_TYPE}">       <!-- website | profile | article -->
  <meta property="og:url" content="{CANONICAL_URL}">
  <meta property="og:site_name" content="Bay Noise">
  <meta property="og:image" content="https://shows.wtf/icon-512.png">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="{OG_TITLE}">
  <meta name="twitter:description" content="{DESCRIPTION}">
  <meta name="twitter:image" content="https://shows.wtf/icon-512.png">

  <!-- Structured data -->
  <script type="application/ld+json">{JSON_LD}</script>

  <style>{INLINE_CSS}</style>
</head>
<body>
  <header class="site-header"><a href="/" class="brand">Bay Noise</a></header>
  <main>
    <h1>{H1}</h1>
    <p class="meta">{META_LINE}</p>
    <section class="shows">
      <h2>Upcoming shows</h2>
      {SHOW_ARTICLES}
    </section>
    <a class="cta" href="/">Browse all Bay Area shows →</a>
  </main>
  <footer class="site-footer">
    Bay Noise — your personal Bay Area show radar ·
    <a href="https://shows.wtf">shows.wtf</a>
  </footer>
</body>
</html>
```

### 4.2 Inline CSS (dark theme matching the app)

Values mirror the app's Tailwind tokens: `bg-neutral-950` = `#0a0a0a`, `text-neutral-100` = `#f5f5f5`, `neutral-400` = `#a3a3a3`, `neutral-700` = `#404040`. Max width `42rem` (≈ `max-w-2xl`).

```css
* { box-sizing: border-box; }
html { color-scheme: dark; }
body {
  margin: 0;
  background: #0a0a0a;
  color: #f5f5f5;
  font: 16px/1.6 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
}
main { max-width: 42rem; margin: 0 auto; padding: 1.5rem 1rem 3rem; }
h1 { font-size: 1.75rem; line-height: 1.2; margin: 0 0 .25rem; }
h2 { font-size: 1.1rem; margin: 2rem 0 .75rem; color: #a3a3a3; font-weight: 600; }
.meta { color: #a3a3a3; margin: 0 0 1rem; font-size: .95rem; }
a { color: #f5f5f5; }
a:hover { color: #fff; }
.site-header { border-bottom: 1px solid #262626; }
.site-header .brand {
  display: inline-block; padding: .75rem 1rem; font-weight: 700; text-decoration: none;
}
.show {
  border: 1px solid #262626; padding: 1rem; margin: 0 0 .75rem;
}
.show .date { font-weight: 600; }
.show .info { color: #a3a3a3; font-size: .9rem; margin: .25rem 0; }
.show .artists { margin: .5rem 0 0; padding: 0; list-style: none; }
.show .artists li { margin: .15rem 0; }
.show .genres { color: #737373; font-size: .85rem; }
.show .venue { color: #d4d4d4; }
.cta {
  display: inline-block; margin-top: 2rem; padding: .6rem 1rem;
  border: 1px solid #404040; text-decoration: none; font-weight: 600;
}
.cta:hover { border-color: #f5f5f5; }
.site-footer {
  border-top: 1px solid #262626; text-align: center; padding: 1.5rem 1rem;
  color: #737373; font-size: .8rem;
}
```

### 4.3 Per-page content

**Venue page** — `/venue/{slug}/index.html`
- `<title>`: `Upcoming shows at {Venue Name} — Bay Noise`
- `description`: `See upcoming live shows at {Venue Name} in {City}. Dates, times, prices, and artists. Updated {data.updated}.`
- `og:type`: `website`
- `<h1>`: `{Venue Name}`
- `meta` line: `{City}` · `{Address}` (omit fields that are null)
- JSON-LD `@type: Place` with `name`, `address` (`PostalAddress`: `streetAddress`, `addressLocality`, `addressCountry: "US"` — omit `addressRegion`), and `event: [...]` (each `@type: Event`, `name: "{Artist A}, {Artist B} at {Venue}"`, `startDate` YYYY-MM-DD, `performer: [@type: MusicGroup, name]`).
- Show article: `date` (day string), `info` (time · price · age), `artists` list with `genres`.
- CTA: `/` with copy "Browse all Bay Area shows →"

**Artist page** — `/artist/{slug}/index.html`
- `<title>`: `Upcoming shows for {Artist Name} — Bay Noise`
- `description`: `See upcoming Bay Area shows featuring {Artist Name}. Dates, venues, and tickets. Updated {data.updated}.`
- `og:type`: `profile`
- `<h1>`: `{Artist Name}`
- `meta` line: genres (comma-joined) + Spotify link if present
- JSON-LD `@type: MusicGroup` with `name`, `genre: [...]` (omit if empty), `event: [...]` (each `@type: Event`, `name: "{Artist Name} at {Venue}"`, `startDate`, `location: { @type: Place, name, address }`).
- Show article: `date`, `venue` (name + city), `info` (time · price), other artists on the bill.
- CTA: `/` with copy "Browse all Bay Area shows →"

**City page** — `/city/{slug}/index.html`
- `<title>`: `Upcoming live shows in {City} — Bay Noise`
- `description`: `Browse upcoming live music and shows in {City}. Venues, dates, artists, and tickets. Updated {data.updated}.`
- `og:type`: `website`
- `<h1>`: `Live shows in {City}`
- `meta` line: `{N} upcoming shows across {M} venues`
- JSON-LD: array of `@type: Event` objects (one per show), each with `name: "{Artist A}, {Artist B} at {Venue}"`, `startDate`, `location: { @type: Place, name, address }`. No wrapping `@type: City` (not a valid schema.org type).
- Show article: `date`, `venue` (name), `info` (time · price), `artists` with genres.
- CTA: `/` with copy "Browse all Bay Area shows →"

### 4.4 Edge cases (handled in `extract.ts` / `templates.ts`)
- **Venue with no city** (`city: null`): omit city from meta line and `PostalAddress`; still generate the page.
- **Venue not in `known-venues.json`**: use the scraped name as-is (no canonical lookup available). These are typically unmatched venues from the pipeline's review queue.
- **Artist with no genres** (`genres: []`): omit genre line; `MusicGroup.genre` omitted from JSON-LD.
- **Artist with no `spotifyUrl`**: omit Spotify link.
- **Artist not in `artist-cache.json`**: use alphabetical order of lowercase-grouped variants for canonical casing.
- **City names with spaces/special chars** (e.g. "Point Reyes Station", "Half Moon Bay"): `slugify` normalizes to `point-reyes-station`, `half-moon-bay`.
- **Slug collisions**: prevented by lowercase grouping + canonical casing (see §2.4). The orchestrator also checks for post-slugify collisions (two entities producing the same slug after the 60-char cap) and skips duplicates with a warning.
- **HTML escaping**: all entity names, addresses, and show text inserted into HTML must be escaped (`&`, `<`, `>`, `"`, `'`). JSON-LD is inserted via `JSON.stringify` (safe inside a `<script>`).
- **Empty upcoming list**: if an entity has zero future shows after filtering, **do not generate a page** and **do not include it in the sitemap** (spec: only entities with upcoming shows).

---

## 5. Build Integration Steps

### 5.1 `package.json` — `build` script
```diff
- "build": "tsc --noEmit && vite build"
+ "build": "tsc --noEmit && vite build && npx tsx scripts/build-seo-pages.ts"
```
The SEO script runs **after** `vite build` so it can write into `dist/` and overwrite the static `dist/sitemap.xml` that Vite copied from `public/`. `tsc --noEmit` runs first and type-checks `scripts/` (per `tsconfig.json` `include: ["src","scripts","functions"]`), so the new code must be type-clean or the build fails.

### 5.2 `vitest.config.ts` — include scripts tests
```diff
- include: ["src/**/*.test.{ts,tsx}", "functions/**/*.test.{ts,tsx}"],
+ include: ["src/**/*.test.{ts,tsx}", "functions/**/*.test.{ts,tsx}", "scripts/**/*.test.{ts,tsx}"],
```

### 5.3 `vite.config.ts` — SW denylist
```diff
- navigateFallbackDenylist: [/^\/\.well-known\//, /^\/robots\.txt$/, /^\/sitemap\.xml$/],
+ navigateFallbackDenylist: [/^\/\.well-known\//, /^\/robots\.txt$/, /^\/sitemap\.xml$/, /^\/venue\//, /^\/artist\//, /^\/city\//],
```

### 5.4 `public/_headers` — global CSP `style-src` update
Update the `/*` block's `Content-Security-Policy` to add `'unsafe-inline'` to `style-src`:

```diff
- Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' static.cloudflareinsights.com; style-src 'self'; img-src 'self' static.cloudflareinsights.com; connect-src 'self' static.cloudflareinsights.com cloudflareinsights.com; base-uri 'self'; form-action 'none'; frame-ancestors 'none'
+ Content-Security-Policy: default-src 'self'; script-src 'self' 'unsafe-inline' static.cloudflareinsights.com; style-src 'self' 'unsafe-inline'; img-src 'self' static.cloudflareinsights.com; connect-src 'self' static.cloudflareinsights.com cloudflareinsights.com; base-uri 'self'; form-action 'none'; frame-ancestors 'none'
```

This allows inline `<style>` blocks on all pages (needed by the SEO billboards). The security impact is minimal: inline CSS cannot execute code, and `base-uri 'self'` + `form-action 'none'` limit the practical attack surface. The app already allows `script-src 'unsafe-inline'`, which is a strictly stronger permission than `style-src 'unsafe-inline'`.

No path-specific `_headers` rules are needed. Cloudflare Pages `_headers` appends (not replaces) headers from matching rules, so path-specific CSP headers would be intersected with the global CSP by the browser — they cannot relax the global policy.

### 5.5 `robots.txt` — no change
`public/robots.txt` already references `Sitemap: https://shows.wtf/sitemap.xml` and allows all crawlers except the data JSON files. No edit needed.

### 5.6 CI
The monthly `pipeline.yml` workflow commits `public/shows.json` etc. The Pages deploy (separate, via Cloudflare Pages git integration) runs `npm run build`, which now generates the SEO pages from the committed JSON. No workflow change required. (If a future workflow runs `build` without committed `public/shows.json`, the orchestrator must fail fast with a clear error — see §6.)

---

## 6. Testing / Verification Checklist

### Unit tests (`npm test`)
- [ ] `src/lib/slug.test.ts`: `slugify("Bottom of the Hill")` → `bottom-of-the-hill`; `"924 Gilman"` → `924-gilman`; `"Yes Ma'am"` → `yes-ma-am`; 60-char cap; empty string → `""`; post-cap collision detection works.
- [ ] `scripts/seo/extract.test.ts`: past dates excluded; lowercase grouping merges `"JT"`/`"Jt"` into one artist; 50-show cap enforced; null-city venue still extracted; entity with zero future shows is omitted; venue canonical name lookup from known-venues works; artist canonical casing from artist-cache works.
- [ ] `scripts/seo/templates.test.ts`: each page type has unique `<title>`; canonical URL matches path; OG + Twitter tags present; JSON-LD `@type` correct (`Place`/`MusicGroup`/array of Events for city); CTA href is `/`; `&` in venue names is escaped to `&amp;`; ≤50 show articles rendered; Event.name includes artist names and venue.
- [ ] `scripts/seo/sitemap.test.ts`: homepage entry priority `1.0`/`daily`; venue & city `0.7`/`weekly`; artist `0.6`/`weekly`; `lastmod` = latest show date per page (not build date); output parses as valid XML; `&` in URLs escaped.
- [ ] Existing tests still pass (especially `add-to-calendar.test.tsx` after the slugify extraction).

### Build verification
- [ ] `npm run build` completes end-to-end with no `tsc` errors.
- [ ] `dist/venue/bottom-of-the-hill/index.html` exists and contains the title, JSON-LD, and CTA `href="/"`. The slug matches the canonical venue name from `known-venues.json`, not the raw scraped string.
- [ ] `dist/artist/amy-miller/index.html` exists (for an artist with a future show).
- [ ] `dist/city/san-francisco/index.html` exists.
- [ ] `dist/sitemap.xml` exists, contains the homepage + venue/artist/city URLs, and has per-page `lastmod` (latest show date per page, not build date). The static `public/sitemap.xml` content is **overwritten** in `dist/`.
- [ ] Orchestrator logs counts: `✓ Generated 137 venue pages, 2371 artist pages, 34 city pages` (numbers approximate).
- [ ] Total file count in `dist/` is under 20,000; `dist/sitemap.xml` is under 50MB.

### Runtime / deploy verification
- [ ] Deploy to a Cloudflare Pages preview branch.
- [ ] `curl -I https://<preview>.pages.dev/venue/bottom-of-the-hill/` → `200`; response `Content-Security-Policy` header contains `style-src 'self' 'unsafe-inline'`.
- [ ] Open the page in a browser; no CSP violations in the console; inline styles render (dark background visible).
- [ ] `curl https://<preview>.pages.dev/sitemap.xml` → valid XML with all URLs.
- [ ] Run a sample venue URL through Google's [Rich Results Test](https://search.google.com/test/rich-results) → `Event`/`Place` structured data recognized with no errors.
- [ ] With the SW installed (load `/` once), navigate to `/venue/bottom-of-the-hill/` → the static billboard is served (not the SPA). Confirms the denylist change.

### Failure-mode checks
- [ ] Delete `public/shows.json` locally, run `npm run build` → orchestrator prints a clear error and exits non-zero (does not silently produce an empty sitemap).
- [ ] Confirm no SEO module is imported anywhere under `src/` except `src/lib/slug.ts` (grep `scripts/seo` in `src/`) → proves no client-bundle bloat.

---

## 7. Rollback Plan

**Primary rollback (stops the bleeding instantly):** revert the `package.json` `build` script to its original form:
```diff
- "build": "tsc --noEmit && vite build && npx tsx scripts/build-seo-pages.ts"
+ "build": "tsc --noEmit && vite build"
```
This stops generating the SEO pages and the dynamic sitemap. The static `public/sitemap.xml` (homepage-only) is copied to `dist/` again as before, so the site returns to its pre-change behavior. No data is lost; the new script files can remain in the repo unused.

**Full rollback (if the SW denylist or CSP change caused issues):**
1. Revert `package.json` `build` (above).
2. Revert `vite.config.ts` `navigateFallbackDenylist` to the original three entries.
3. Revert `public/_headers` to remove `'unsafe-inline'` from `style-src`.
4. Revert `src/components/add-to-calendar.tsx` to its local `slugify` (or leave the `src/lib/slug.ts` import — it's behavior-identical and harmless).
5. Redeploy.

All changes are additive to `dist/` output and isolated config; none alter the SPA's runtime behavior.

---

## 8. Phased Execution Summary

| Phase | Tasks (file #s) | Parallel? | Depends on |
|---|---|---|---|
| **1 — Foundation** | #1 slug.ts, #2 slug.test, #10 refactor add-to-calendar, #11 package.json, #12 vitest.config, #13 vite.config, #14 _headers | Yes (all independent) | — |
| **2 — Core pure logic** | #3 extract.ts, #5 templates.ts, #7 sitemap.ts (+ their tests #4,#6,#8) | Yes (three independent modules) | Phase 1 (#1 slug) |
| **3 — Orchestrator** | #9 build-seo-pages.ts | No | Phase 2 |
| **4 — Integration verify** | Run `npm run build` + `npm test`; inspect `dist/` (§6 checklist) | No | Phase 3 |
| **5 — Review** | Adversarial review of `scripts/seo/*` + orchestrator + `_headers`/`vite.config` | No | Phase 4 |

---

## 9. Risk Register

| Risk | Impact | Mitigation / Backup |
|---|---|---|
| Global CSP `style-src 'unsafe-inline'` weakens security | Minor: inline CSS can't execute code; `base-uri 'self'` limits injection surface | Accepted trade-off. App already allows `script-src 'unsafe-inline'` (stronger). Backup: emit a single shared `/seo.css` and `<link>` it (requires `style-src 'self'` but loses self-containment). |
| SW `navigateFallback` serves SPA instead of billboard on flaky network | Returning users miss the SEO page | Add path prefixes to `navigateFallbackDenylist` (§5.3). Backup: accept crawler-only correctness (crawlers have no SW). |
| Artist slug collisions from 60-char cap or casing | Missing/duplicate pages | Lowercase grouping + canonical casing from artist-cache (§2.4). Defensive collision check in orchestrator that logs + skips. |
| ~2,540 files inflate deploy size / build time | Slow builds, large deploys | Under Cloudflare's 20k-file limit. Backup: cap artist pages to acts with ≥2 future shows, or split sitemap into a sitemap index. |
| `tsc --noEmit` fails on new script code | Build breaks | Write type-clean code; pure modules + typed `ShowsData`/`VenueEvent`/`Artist` imports from `src/lib/types.js` (same pattern as `build-data.ts`). |
| `public/shows.json` missing at build time | Empty/failed generation | Orchestrator checks file existence, prints clear error, exits non-zero. Pipeline commits the JSON before deploy. |
| Venue slug mismatch between SEO page and SPA | CTA funnel broken | Extract canonical venue names from `known-venues.json` before slugifying (§2.4). |
