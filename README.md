# Bay Noise

Your personal Bay Area show radar.

A mobile-first PWA that scrapes [foopee.com](http://www.foopee.com/punk/the-list/),
enriches artist names via the Spotify API, deduplicates venues, and serves
a personalized genre-matched show feed — no accounts, no backend, no bullshit.

## Stack

- **Frontend:** Preact SPA + TypeScript + Tailwind v4
- **Data pipeline:** TypeScript (runs via `tsx`), cheerio, Spotify API
- **Hosting:** Cloudflare Pages (static + function)
- **Calendar:** iCal subscription endpoint + per-event ICS downloads
- **Offline:** vite-plugin-pwa (service worker, StaleWhileRevalidate)

## Quick start

```bash
npm install
npm run dev        # Vite dev server
npm test           # Vitest (105+ tests)
npm run pipeline   # Scrape + enrich + build shows.json
npm run build      # tsc + vite build
```

## Data pipeline

```bash
# Scrape foopee.com, deduplicate venues, enrich via Spotify,
# parse extra fields, then write public/shows.json
npm run pipeline
```

### Spotify setup (required for genre enrichment)

The pipeline uses the Spotify API to look up artist genres. Without it,
all artists get empty genres and the personalized feed won't work.

1. Create an app at https://developer.spotify.com/dashboard
2. Copy the **Client ID** and **Client Secret**
3. Run the pipeline with these set:

```bash
SPOTIFY_CLIENT_ID=abc123 SPOTIFY_CLIENT_SECRET=xyz789 npm run pipeline
```

Or add them to a local `env.sh` file (gitignored):

```bash
export SPOTIFY_CLIENT_ID=abc123
export SPOTIFY_CLIENT_SECRET=xyz789
```

For GitHub Actions, set `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET`
as repository secrets in Settings → Secrets and variables → Actions.

## Structure

```
src/lib/           Pure functions (types, genres, filter, ics, prefs)
src/components/    Preact components (show-card, show-feed, greeter, etc.)
src/app.tsx        App shell — data fetch, view state, filter state
scripts/           build-data.ts — single pipeline script
functions/         Cloudflare Pages Function (calendar.ics.ts)
public/            Static assets + generated data files
```

## License

AGPL-3.0 — see [LICENSE](LICENSE).
