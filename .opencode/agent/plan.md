# Bay Noise

## What
Mobile-first PWA that scrapes foopee.com, enriches artist names via Spotify API, deduplicates venues, and serves a personalized genre-matched show feed. Preact SPA on Cloudflare Pages.

## What not
- No React, no router, no context/store library
- No separate artist/venue/day pages — everything on one feed
- No fuzzy matching for venue dedup — exact match after normalization
- No separate corrections/spelling files — enrichment at the source
- No shadcn/ui or component libraries — minimal custom components
- No auth, no accounts, no backend
- No Levenshtein distance — removed from new codebase

## Key files
- `src/lib/types.ts` — shared contract (ShowsData, ShowDay, VenueEvent, Artist, ScoredShow, FilterState)
- `scripts/build-data.js` — single pipeline: scrape → dedup → enrich → output public/shows.json
- `src/app.tsx` — app shell, data fetch, view state (greeter vs feed), filter state
- `src/lib/genres.ts` — genre taxonomy map (13 broad categories)
- `src/lib/filter.ts` — show scoring (artist-count match), filtering, sorting, search
