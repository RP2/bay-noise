# Bay Noise

**[shows.wtf](https://shows.wtf)** — your personal Bay Area show radar.

Finding shows around the Bay shouldn't mean following different venues on social media or visiting individual websites. Bay Noise scrapes the legendary [foopee list](http://www.foopee.com/punk/the-list/), enriches it with Spotify data, and puts smart filters on top so the shows you'd actually attend surface in seconds. Personalized feed, calendar subscription, installable PWA — no accounts, no backend, no bullshit.

## How it works

1. **Scrape.** The pipeline pulls all upcoming shows from foopee.com and parses out date, venue, city, artists, time, price, and age restrictions. CI updates the data monthly.
2. **Enrich.** Artists get genres and links from the Spotify API (cached, so re-runs are cheap). Venues are deduplicated against a curated list with street addresses; stragglers land in a review queue.
3. **Filter.** Pick your genres once. Every show gets scored by how many artists on the bill match your taste — matches float to the top, everything else hides below the fold.
4. **Subscribe.** One tap copies a personalized iCal URL that mirrors your active filters. Your calendar app stays in sync on its own.

## The smart part

- **Genre scoring** — the feed ranks by matching artists per bill, not just date. Zero-match shows collapse behind a "show all" toggle instead of burying the good stuff.
- **Search that resolves** — type a venue, city, artist, or genre and hit Enter: it becomes a filter chip, not a text search. Chips stack freely, and plain free-text search is still there when nothing matches.
- **Everything is a filter** — click any artist, venue, or genre on a show card to pivot the whole feed around it.
- **Personalized calendar feed** — `/calendar.ics` takes your genres, venues, cities, and artists as query params, so the subscription URL always matches what's on screen. Per-show ICS downloads too.
- **Your prefs stay yours** — genre preferences live in localStorage. Nothing to sign up for, because there's no server-side state at all.

## Stack

- **Frontend:** Preact + TypeScript + Tailwind v4 (Vite), mobile-first
- **PWA:** vite-plugin-pwa / Workbox — installable, offline-capable, `shows.json` served stale-while-revalidate
- **Pipeline:** TypeScript via `tsx`, cheerio, Spotify Web API
- **Hosting:** Cloudflare Pages + Pages Functions (`/calendar.ics`)
- **CI:** GitHub Actions runs the pipeline the first Monday of each month and commits the fresh data

## Quick start

```bash
npm install
npm run dev        # Vite dev server
npm test           # Vitest — 192 tests
npm run pipeline   # Scrape + enrich + rebuild public/shows.json
npm run build      # tsc + vite build
```

### Spotify credentials (pipeline only)

Genre enrichment needs a Spotify API app. Without credentials the pipeline still runs — artists just get empty genres and personalization won't work.

1. Create an app at https://developer.spotify.com/dashboard
2. Run the pipeline with the credentials set:

```bash
SPOTIFY_CLIENT_ID=abc123 SPOTIFY_CLIENT_SECRET=xyz789 npm run pipeline
```

For GitHub Actions, set `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` as repository secrets (Settings → Secrets and variables → Actions).

### Venue review queue

Venues the pipeline can't confidently match accumulate in `public/unmatched-venues.json`. Review them, then promote into the curated list:

```bash
npm run promote
```

## Structure

```
src/lib/           Pure functions — types, scoring/filter, ICS, prefs
src/components/    Preact UI — greeter, search bar, feed, show cards
src/app.tsx        App shell — data loading, prefs, filter state
scripts/           build-data.ts (the pipeline), promote-unmatched.js
functions/         Cloudflare Pages Functions (iCal feed, domain redirect)
public/            Generated data — shows.json, available-genres.json,
                   known-venues.json, artist-cache.json
```

## License

AGPL-3.0 — see [LICENSE](LICENSE).
