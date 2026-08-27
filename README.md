# Bay Noise

**[shows.wtf](https://shows.wtf)** — your personal Bay Area show radar.

Finding shows around the Bay should not mean following different venues on social media. Bay Noise scrapes the [foopee list](http://www.foopee.com/punk/the-list/), enriches it with Spotify data, and puts smart filters on top. Personalized feed, calendar subscription, installable PWA. No accounts, no backend, no bullshit.

## How it works

1. **Scrape.** The pipeline pulls all upcoming shows from foopee.com and parses date, venue, city, artists, time, price, and age restrictions. CI updates the data monthly.
2. **Enrich.** Artists get genres and links from the Spotify API. Venues are deduplicated against a curated list. Stragglers land in a review queue.
3. **Filter.** Pick your genres once. Every show gets scored by how many artists match your taste. Matches float to the top.
4. **Subscribe.** One tap copies a personalized iCal URL that mirrors your active filters.
5. **Index.** The build generates static HTML pages for every venue, artist, and city. Search engines can crawl these pages to discover shows.

## The smart part

- **Genre scoring** — the feed ranks by matching artists per bill, not just date. Zero-match shows collapse behind a "show all" toggle.
- **Search that resolves** — type a venue, city, artist, or genre and hit Enter. It becomes a filter chip. Chips stack freely.
- **Everything is a filter** — click any artist, venue, or genre on a show card to pivot the whole feed.
- **Personalized calendar feed** — `/calendar.ics` takes your genres, venues, cities, and artists as query params.
- **Your prefs stay yours** — genre preferences live in localStorage. Nothing to sign up for.

## SEO pages

The main app is a single-page Preact app with no router. Search engines see an empty shell. To fix this, the build generates static HTML pages that list upcoming shows for every venue, artist, and city in the data.

Each page is self-contained HTML with inline styles, meta tags, and JSON-LD structured data. No JavaScript, no framework runtime. A CTA links back to the main app.

The build also generates index pages at `/venue/`, `/artist/`, and `/city/` that list all entities as links. These hub pages reduce crawl depth for search engines.

The orchestrator lives at `scripts/build-seo-pages.ts`. Pure logic lives at `scripts/seo/{extract,templates,sitemap}.ts`.

## Stack

- **Frontend:** Preact + TypeScript + Tailwind v4 (Vite), mobile-first
- **PWA:** vite-plugin-pwa / Workbox — installable, offline-capable
- **Pipeline:** TypeScript via `tsx`, cheerio, Spotify Web API
- **SEO:** Static HTML generation at build time — `scripts/seo/` modules
- **Hosting:** Cloudflare Pages + Pages Functions (`/calendar.ics`)
- **CI:** GitHub Actions runs the pipeline the first Monday of each month

## Quick start

```bash
npm install
npm run dev        # Vite dev server
npm test           # Vitest — 300 tests
npm run pipeline   # Scrape + enrich + rebuild public/shows.json
npm run build      # tsc + vite build + SEO pages
```

### Previewing SEO pages

```bash
npm run build
npx serve dist     # static file server on localhost:3000
```

Open `/venue/bottom-of-the-hill/`, `/artist/nerf-herder/`, or `/city/san-francisco/` to see the generated pages. Do not use `npm run dev` — the Vite dev server serves the SPA for all routes.

### Spotify credentials (pipeline only)

Genre enrichment needs a Spotify API app. Without credentials the pipeline still runs. Artists just get empty genres and personalization will not work.

1. Create an app at https://developer.spotify.com/dashboard
2. Run the pipeline with the credentials set:

```bash
SPOTIFY_CLIENT_ID=abc123 SPOTIFY_CLIENT_SECRET=xyz789 npm run pipeline
```

For GitHub Actions, set `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` as repository secrets (Settings → Secrets and variables → Actions).

### Venue review queue

Venues the pipeline can not confidently match accumulate in `public/unmatched-venues.json`. Review them, then promote into the curated list:

```bash
npm run promote
```

## Structure

```
src/lib/           Pure functions — types, scoring/filter, ICS, prefs, slugify
src/components/    Preact UI — greeter, search bar, feed, show cards
src/app.tsx        App shell — data loading, prefs, filter state
scripts/           build-data.ts (pipeline), promote-unmatched.js
scripts/seo/       SEO page generation — extract, templates, sitemap
scripts/build-seo-pages.ts  Orchestrator — reads JSON, writes static pages to dist/
functions/         Cloudflare Pages Functions (iCal feed, domain redirect)
public/            Generated data — shows.json, known-venues.json,
                   artist-cache.json, available-genres.json
```

## License

AGPL-3.0 — see [LICENSE](LICENSE).
