# Bay Noise — Migration Guide

## Overview

Rewrite of `bay-punks` (Astro SSG) → `bay-noise` (Preact SPA). Data pipeline simplified from 4 scripts to 1. UX redesigned from tabbed browsing to personalized "for you" show feed. Hardcoded data patches replaced by enrichment at the source (Spotify API canonical names, alias accumulation).

---

## ALWAYS Rules

1. **TypeScript everywhere.** Frontend, functions, tests. Pipeline (`build-data.js`) is plain JS but uses JSDoc `@typedef` to reference types.
2. **Types in `src/lib/types.ts`.** Import from there. Never redefine types locally.
3. **Pure functions in `src/lib/`.** No side effects. The only allowed exception is `lib/prefs.ts` (localStorage is the feature).
4. **Tests beside source.** `genres.ts` → `genres.test.ts`. One test file per module. Every pure function has thorough tests. Components have basic render + interaction tests.
5. **Fetch data at runtime.** SPA calls `fetch('/shows.json')` in a `useEffect` in `app.tsx`. No static imports of data.
6. **Preact patterns.** Use `h()`, JSX, hooks (`useState`, `useEffect`, `useCallback`). `@preact/preset-vite` handles JSX. Write standard TSX syntax.
7. **Tailwind v4.** Utility classes only. `style.css` is just `@import "tailwindcss"` + CSS variable overrides for dark mode.
8. **Dark mode via `class="dark"` on `<html>`.** System preference detected in inline `<script>` in `index.html` (before first render). Tailwind `dark:` variants handle styling. No toggle.
9. **One commit per unit.** Message format: `bay-noise: <unit-name> — <description>`.
10. **`TODO(port)` markers for uncertainty.** `// TODO(port): <reason>` when unsure. `// NOTE(port): <why>` for intentional oddities.
11. **`shows.json` is the single source of truth.** Pipeline writes to `public/shows.json`. SPA fetches `/shows.json`. Pages Function imports `../public/shows.json` at compile time.
12. **Use data enrichment, not hardcoded correction files.** Artist names are canonicalized via Spotify search. Venue names are deduplicated via alias accumulation. **The genre taxonomy map (`GENRE_MAP`) and inline venue/city abbreviation maps are the only hardcoded lookup tables allowed** — they are classification systems, not data patches. No separate `spelling-corrections.json` or similar file.
13. **Genre taxonomy: one Spotify genre → exactly one broad category.** No overlaps. Document edge cases in `genres.ts`.

## NEVER Rules

1. **No React.** Use Preact. If you write `import React from 'react'`, you're wrong. Use `import { h } from 'preact'` (JSX is handled by the preset).
2. **No DOM manipulation.** No `document.querySelector`, `innerHTML`, `createElement` except the dark-mode inline script in `index.html`.
3. **No router/spa-routing library.** This is one page. Conditional rendering with `useState`.
4. **No context/store/state-management library.** `useState` in `app.tsx` is enough.
5. **No shadcn/ui components.** Write minimal custom components with Tailwind only.
6. **No separate artist/venue/day pages.** No routes. No navigation. Everything on one page.
7. **No `node-fetch`.** Use Node 22 native `fetch()` in the pipeline.
8. **No Levenshtein distance or fuzzy matching.** Venue dedup is exact (after stripping city suffix). If it doesn't match exactly, it's a new venue.
9. **No stub code, no placeholders.** Every function implemented. If uncertain, `// TODO(port)` and flag it.
10. **No rewriting tests to match broken code.** Fix the code.
11. **No empty `TODO(port)`.** Every TODO must have a clear reason. `TODO(port)` without a reason is a bug.
12. **No separate corrections file (`.json` or otherwise) for artist/venue/city name patches.** The only hardcoded data in the pipeline is: (a) the inline venue shorthand map (~15 entries), and (b) the inline city abbreviation map (~10 entries). The genre `GENRE_MAP` in `src/lib/genres.ts` is a classification system, not a patch file.

---

## Map: Old → New

### Files

| Old (bay-punks) | New (bay-noise) | Notes |
|----------------|-----------------|-------|
| `src/pages/index.astro` | `src/app.tsx` | Main SPA component |
| `src/pages/day/[slug].astro` | _dropped_ | Date is just a heading in the feed |
| `src/pages/artist/[slug].astro` | _dropped_ | Tap artist name filters the feed |
| `src/pages/venue/[slug].astro` | _dropped_ | Tap venue name filters the feed |
| `src/components/Day.astro` | `src/components/show-card.tsx` | Single event show card |
| `src/components/DayList.astro` | `src/components/show-feed.tsx` | The main feed list |
| `src/components/TabsWrapper.tsx` | _dropped_ | No tabs |
| `src/components/ArtistList.tsx` | _dropped_ | Replaced by filter-on-tap |
| `src/components/VenueList.tsx` | _dropped_ | Replaced by filter-on-tap |
| `src/components/AddToCalendarButton.tsx` | `src/components/add-to-calendar.tsx` | Per-event ICS download |
| `src/layouts/Layout.astro` | `index.html` | Inline head/body, no Astro layout |
| `src/lib/shared-utils.js` | `src/lib/` (split) | Split into `genres.ts`, `filter.ts`, `prefs.ts`, `ics.ts` |
| `src/lib/shows-utils.ts` | `src/lib/filter.ts` | Replaces show sorting/filtering logic |
| `src/lib/data-utils.ts` | _dropped_ | No ID lookups needed (no detail pages) |
| `src/lib/dom-utils.ts` | _dropped_ | No DOM manipulation (Preact handles it) |
| `src/data/calendar.json` | `public/shows.json` | Simplified format (see below) |
| `src/data/artists.json` | _dropped_ | Merged into shows.json |
| `src/data/venues.json` | _dropped_ | Merged into shows.json |
| `src/data/raw.json` | _dropped_ | Inline in pipeline |
| `src/data/spelling-corrections.json` | _dropped_ | Replaced by Spotify enrichment + alias accumulation |
| `scripts/scrape-concerts.js` | `scripts/build-data.js` | Unified pipeline |
| `scripts/process-databases.js` | `scripts/build-data.js` | Unified pipeline |
| `scripts/spotify-verify.js` | `scripts/build-data.js` | Unified pipeline (inline Spotify matching) |
| `scripts/generate-calendar.js` | _dropped_ | Output is part of build-data |
| `functions/_middleware.js` | _dropped_ | Handled by Cloudflare Pages redirect rules |
| — | `functions/calendar.ics.ts` | NEW — iCal subscription endpoint |
| — | `src/components/greeter.tsx` | NEW — onboarding genre picker |
| — | `src/components/search-bar.tsx` | NEW — search input component |
| — | `src/components/feed-subscribe.tsx` | NEW — header iCal subscribe link |

### Data format (shows.json)

**Old (`calendar.json`):**
```json
{
  "shows": [
    {
      "day": "Tue Jun 2",
      "normalizedDate": "2026-06-02",
      "events": [
        {
          "venue": { "text": "4 Star Theater, S.F.", "id": "4-star-theater-sf", "href": "..." },
          "bands": [{ "text": "Mia Wilson", "id": "mia-wilson", "href": "..." }],
          "extra": "a/a 7pm/8pm"
        }
      ]
    }
  ]
}
```

**New (`shows.json`):**
```json
{
  "updated": "2026-07-20",
  "shows": [
    {
      "date": "2026-06-02",
      "day": "Tue Jun 2",
      "venues": [
        {
          "name": "4 Star Theater, S.F.",
          "city": "San Francisco",
          "artists": [
            { "name": "Mia Wilson", "genres": ["punk", "indie"], "spotifyUrl": "https://..." }
          ],
          "extra": "a/a · 7pm/8pm",
          "time": "7pm/8pm",
          "price": null,
          "age": "a/a"
        }
      ]
    }
  ]
}
```

Key differences:
- `events` → `venues` (renamed, restructured)
- `bands` → `artists` (renamed)
- `venue.text` → `venue.name`, `venue.city` (extracted at pipeline time)
- `band.text` → `artist.name`, `artist.genres`, `artist.spotifyUrl`
- `normalizedDate` → `date` (shorter)
- No `id` fields anywhere (no detail pages)
- Top-level `updated` timestamp
- `extra` is a display-friendly string. Pipeline parses raw extra into `time?`, `price?`, `age?` structured fields (or null if not found).

### Types

See `src/lib/types.ts` — the complete type definition. All code must use these types. Pipeline produces JSON conforming to `ShowsData`.

Types defined: `ShowsData`, `ShowDay`, `VenueEvent`, `Artist`, `UserPrefs`, `ScoredShow`, `FilterState`. The `FilterState` interface is used by the search bar, show feed, and app shell components for filter interactions.

### Idioms

| Old | New |
|-----|-----|
| Astro `---` frontmatter + template | Preact TSX components |
| `client:load`, `client:visible` | N/A — everything is client-side |
| Radix UI / shadcn components | Minimal custom HTML + Tailwind |
| Multiple `useEffect` for side effects | One `useEffect` for data fetch in `app.tsx` |
| Importing JSON at build time | `fetch('/shows.json')` at runtime |

---

## Exceptions

| Rule | Exception | Why |
|------|-----------|-----|
| No DOM manipulation | Inline `<script>` in `index.html` for dark mode system preference detection | Must run before first render to prevent flash. Preact hasn't mounted yet. |
| Pipeline must be JS not TS | `scripts/build-data.js` | It's a Node script, not a web module. Uses JSDoc `@typedef` to reference types from `src/lib/types.ts`. |
| No external libraries | `cheerio` in pipeline | Needed for HTML parsing of foopee pages. No viable alternative. |
| Pure functions only | `lib/prefs.ts` | `localStorage` is a side effect but it IS the feature. Document with `// NOTE(port): intentional side effect`. |
| No `node-fetch` | Use native `fetch()` | Node 22 has stable `fetch`. No dependency needed. |
| No hardcoded data lists | (a) Inline venue shorthand map (~15 entries) in pipeline | Spotify doesn't resolve venue name shorthand like "fillmore" → "The Fillmore". This map is the minimum viable patch and lives inline in `build-data.js`. |
| No hardcoded data lists | (b) Inline city abbreviation map (~10 entries) in pipeline | No external API resolves "sf" → "San Francisco". Also inline in `build-data.js`. |
| No hardcoded data lists | (c) Genre taxonomy map in `src/lib/genres.ts` | This is a classification system for recommendation, not a data patch. It maps Spotify genres to broad categories. |
| No separate patch files | `public/known-venues.json` | Curated venue list plus aliases accumulated across pipeline runs. This is the single source of truth for venue names; the pipeline reads it, enriches it, writes it back. |

---

## Markers

```
// TODO(port): <reason>     — When uncertain about correctness or best approach. MUST include reason.
// NOTE(port): <why>        — When doing something intentional that looks wrong. MUST include why.
```

Reviewers: `TODO(port)` without a clear reason is a bug. `NOTE(port)` without a clear why is a bug.

---

## Pre-Computed Hard Decisions

These are locked. Do not change them during implementation without escalation.

### HD 1: Data file location
`public/shows.json`. Pipeline writes to `public/shows.json`. SPA fetches `/shows.json`. Pages Function statically imports `../public/shows.json` at compile time (esbuild bundles it into the function on deploy). File is tracked in git.

### HD 2: Artist name canonicalization via Spotify enrichment
Pipeline searches Spotify API for every scraped artist name. Use OAuth Client Credentials flow with `SPOTIFY_CLIENT_ID` and `SPOTIFY_CLIENT_SECRET` from environment variables.

**Matching algorithm:** Normalize artist name (lowercase, strip punctuation), search Spotify's `/search?type=artist`. If the top result's name normalizes to the same string as the input, accept it as a match. Use Spotify's canonical `name` field as primary, store scraped name in `aliases[]` on the artist. If no match or top result confidence is low (normalized names differ), keep scraped name as-is.

**Rate limiting:** Pace requests with a 100ms delay between searches (max 10 req/s, well under Spotify's 30/s burst limit). On HTTP 429, retry with exponential backoff (1s → 2s → 4s, max 3 retries). On persistent failure for an artist, skip enrichment for that artist (log a warning, keep scraped name).

**Caching:** Accumulate results across runs in a tracked `public/artist-cache.json` file. Before searching Spotify, check the cache. New artists get searched and added. This prevents re-searching 2,000+ artists every month. The cache is keyed by normalized scraped name and stores the Spotify result.

The `spotifyUrl` field on `Artist` is optional (`?`) in the type — if Spotify enrichment fails or is skipped, the field is absent.

### HD 3: Venue deduplication with alias accumulation
Four-step process:
a. Expand common venue shorthand from inline map (~15 entries inline in `build-data.js`)
b. Strip trailing city/location suffix (", S.F.", ", San Francisco", ", Oakland", ", Berkeley", ", CA", etc.)
c. Normalize (lowercase, strip punctuation, trim whitespace)
d. Check against `public/known-venues.json` — the single source of truth. Match canonical names and known aliases algorithmically. If the scraped name matches a known venue, use its canonical name and add the raw name as a new alias.
e. After processing all shows, write back `public/known-venues.json` with any new aliases or venues accumulated.

This file is the EXCEPTION to NEVER rule 12 — it's accumulated state, not a patch file.

### HD 4: City extraction
Parse city from venue name suffix using inline abbreviation map (~10 entries inline in `build-data.js`). Map: `"sf"` → `"San Francisco"`, `"s.f."` → `"San Francisco"`, `"san francisco"` → `"San Francisco"`, `"oakland"` → `"Oakland"`, `"oak"` → `"Oakland"`, `"berkeley"` → `"Berkeley"`, `"berk"` → `"Berkeley"`, `"san jose"` → `"San Jose"`, `"sj"` → `"San Jose"`, `"palo alto"` → `"Palo Alto"`. If no city extracted, city is `null` (frontend handles gracefully).

### HD 5: Genre taxonomy
Locked list in `src/lib/genres.ts`. Each Spotify genre string maps to exactly one broad category. No overlaps. ~13 broad categories. Artists with unmapped genres fall into `"other"` — shows still appear but are not boosted. Edge cases documented with comments in `genres.ts`.

### HD 6: Pipeline schedule
GitHub Actions cron runs `node scripts/build-data.js` every first Monday of the month. Commits `public/shows.json`, `public/known-venues.json`, and `public/artist-cache.json` if changed. Deploy triggers automatically. The workflow must verify `public/shows.json` is non-empty and valid JSON before committing.

### HD 7: State management
```ts
type View = 'greeter' | 'feed';
type DataStatus = 'loading' | 'loaded' | 'error';
interface FilterState { query: string; venue: string | null; artist: string | null; showAll: boolean; }
```
View state, data state (ShowsData | null), data status, filter state. All in `useState` in `app.tsx`. No context, no store.

### HD 8: Data fetch
Single `useEffect` in `app.tsx`. Fetches `/shows.json` on mount. Sets status: `'loading'` → `'loaded'` or `'error'`. Error state shows message + retry button.

### HD 9: Search + filter
Free-text search input in the feed header. Searches across artist names, venue names, and `extra` field. Tap venue name → sets `filter.venue`. Tap artist name → sets `filter.artist`. `filter.showAll` bypasses genre scoring fold. An active venue or artist filter shows a dismissible chip/tag with an × to clear it.

**Search + filter interaction:** AND. When both a query AND venue/artist filter are active, both must match. Search scopes to the already-filtered set.

**Scoring algorithm:** `scoreShow()` returns the number of artists in the show where at least one genre intersects `preferredGenres`. Score > 0 = above fold (personalized section). Score = 0 = below fold (hidden behind "Show all" toggle). The fold toggle only renders when at least one score=0 show exists.

### HD 10: iCal sharing
`lib/ics.ts` has the core `generateIcs()` pure function. Generates all-day events from `ShowDay.date`. The `extra` field is not parsed for time — events are all-day. Both consumers use the same function:
- `components/add-to-calendar.tsx` — per-event ICS download (one day's events)
- `functions/calendar.ics.ts` — full feed subscription (all upcoming shows)

### HD 11: Dark mode
System preference detected in inline `<script>` in `<head>`. Sets/removes `class="dark"` on `<html>`. Tailwind `dark:` variants handle styling. No toggle (follows system). Theme choice stored in localStorage as `'bay-noise-theme'`.

### HD 12: Test approach
Pure function tests are thorough (genres, filter, ics, prefs). Component tests use `@testing-library/preact` + `vitest` + `happy-dom`. Components tested: renders without crash, click handler fires, conditional content shows/hides.

**Test fixtures:** Shared test data lives in `src/lib/__fixtures__/shows.ts`. All tests import from here. The fixture exports `SAMPLE_SHOWS` (minimal `ShowsData` with a few shows) and `EMPTY_SHOWS` (no shows).

**Async component testing:** `fetch` is mocked globally via `vi.stubGlobal('fetch', mockFn)` in `vitest.setup.ts`. A reusable `mockFetch(data)` helper returns a resolved Response. Use `@testing-library/preact`'s `waitFor` / `findByText` for async assertions. Loading state: assert on text "Loading..." or a `data-loading` attribute. Error state: mockFetch rejects → assert error message + retry button.

### HD 13: PWA
`vite-plugin-pwa` with `autoUpdate` register type. Manifest in `public/manifest.json` with `display: standalone`, name "Bay Noise", `background_color: #000000`, `theme_color: #000000`. Workbox runtime caching for `/shows.json` with `StaleWhileRevalidate`. SW is generated by the plugin — no manual SW code.

### HD 14: Pipeline dependency on types
`build-data.js` must produce JSON matching `ShowsData`. It references `src/lib/types.ts` via JSDoc `@typedef` imports. A mismatch between pipeline output and TypeScript types is a data quality bug.

### HD 15: Spotify link behavior
External links open in new tab via `target="_blank" rel="noopener noreferrer"`. The `spotifyUrl` field on `Artist` is optional — frontend must guard against `undefined`.

### HD 16: Greeter genre list
The greeter shows the 13 keys of `GENRE_MAP` as selectable pills. No curated subset — it's data-driven from the taxonomy. Updates to `GENRE_MAP` automatically update the greeter.

### HD 17: Edge cases

| Scenario | Behavior |
|----------|----------|
| Greeter: 0 genres selected, user clicks "Show me what's on" | Save prefs with `preferredGenres: []`, `onboarded: true`. Feed shows ALL shows sorted by date, no scoring, no fold toggle. |
| Fold: 0 shows match user's genres | Empty personalized section. "Show all" toggle appears immediately showing all shows. |
| Fold: ALL shows match (every show has score > 0) | No "Show all" toggle. All shows shown scored. No fold. |
| Search: empty results | Show "No shows match your search" with a clear-search button |
| Pipeline: first run (no cache files exist) | Graceful ENOENT handling. Initialize empty maps. Log "first run — no cache files found" |
| Pipeline: FooPee site down or returns no data | Log error, abort with exit code 1. Existing `shows.json` stays untouched. |
| Prefs: stored genre was removed from GENRE_MAP | Silently ignore stale genres. User can redo greeter. |
| Spotify: 429 rate limit exceeded after retries | Log warning for that artist, skip enrichment, keep scraped name, cache as "no match" |
| Data fetch: failed network | Show error state with message and retry button |
| Data fetch: empty shows.json (no upcoming shows) | Show "No upcoming shows right now. Check back later." with a cheerful illustration substitute |

### HD 18: Extra field parsing
Pipeline parses the raw `extra` string from FooPee into structured fields on `VenueEvent`:
- `time?: string` — extracted time pattern (e.g., "9pm", "7pm/8pm", "6:30pm/7:30pm")
- `price?: string` — extracted price pattern (e.g., "$15", "$10-$12", "free")
- `age?: string` — extracted age restriction (e.g., "a/a", "21+", "all ages", "5+")
- `extra: string` — display-friendly string combining parsed fields (e.g., "9pm · $15" or "a/a · 7pm/8pm")

The `parseExtra()` function in the pipeline handles these patterns. If a field is not found, it is `null` (not omitted — preserves JSON consistency).

---

## PWA Implementation

| Component | File | Notes |
|-----------|------|-------|
| Manifest | `public/manifest.json` | `display: standalone`, name "Bay Noise", icons 192+512, theme/background: `#000000` |
| Service Worker | Generated by `vite-plugin-pwa` | `registerType: 'autoUpdate'`, never write SW manually |
| Runtime Caching | `vite.config.ts` → `VitePWA.workbox.runtimeCaching` | `/shows.json` with `StaleWhileRevalidate` |
| Install prompt | Browser native | Chrome on Android, Safari iOS via share sheet |
| Offline behavior | Full UI renders with cached `shows.json` | Stale data is acceptable for offline use |

---

## Pipeline Data Flow

```
FooPee HTML
    │
    ▼
parse with cheerio (extract venue + artist names)
    │
    ├──▶ Check artist-cache.json (keyed by normalized scraped name)
    │       ├── cache hit → use cached Spotify data
    │       └── cache miss → Spotify search (rate-limited, retry on 429)
    │                       ├── confident match → use Spotify's canonical name
    │                       │   └── store scraped name as alias, cache result
    │                       ├── weak/no match → keep scraped name
    │                       │   └── cache as "no match" (skip next time)
    │                       └── failure (429 exhausted) → skip, keep scraped name
    │
    ├──▶ Venue dedup pipeline
    │       ├── apply inline shorthand map (~15 entries)
    │       ├── strip city suffix
    │       ├── match canonical names + aliases against known-venues.json
    │       ├── match → use canonical name + accumulate new alias
    │       └── no match → create new venue entry
    │
    ├──▶ Filter non-artists (reuse isNonArtist logic)
    │
    ├──▶ Extract city from venue name suffix (inline abbrev map, ~10 entries)
    │
    ├──▶ Write known-venues.json (updated with any new aliases or venues)
    │
    ├──▶ Write artist-cache.json (updated with any new searches)
    │
    ▼
write public/shows.json (conforms to ShowsData type)
```

---

## Adversarial Review Checklist

Reviewers check for:

1. **Unmarked divergence from this guide** — deviating from any ALWAYS/NEVER/MAP/EXCEPTION/HD without a `NOTE(port)` or `TODO(port)`. Automatic bug.

2. **Type mismatches** — wrong import path for types, redefining types locally instead of importing from `types.ts`.

3. **React instead of Preact** — any `import React from 'react'`, `React.FC`, etc. Use Preact types. `@preact/preset-vite` handles JSX.

4. **DOM manipulation outside allowed exception** — any `querySelector`, `innerHTML`, `createElement` outside the dark-mode inline script.

5. **Missing tests** — every `lib/*.ts` file must have a corresponding `*.test.ts` file with at least one test.

6. **Pipeline complexity** — fuzzy matching, Levenshtein, or multi-step processing. Venue dedup is strip-city → normalize → exact match only.

7. **Stub/placeholder code** — `throw new Error('not implemented')` is a bug.

8. **Missing error handling** — data fetch without error state, pipeline without error logging.

9. **Hardcoded values that should be configurable** — Spotify API keys, domain names, etc.

10. **Data format divergence** — `shows.json` structure must match `ShowsData` exactly.

11. **Corrections file creep** — any new `.json` file added to `src/data/` or `public/` beyond the allowed three: `shows.json`, `known-venues.json`, `artist-cache.json`. Also verify `spelling-corrections.json` does not exist.
