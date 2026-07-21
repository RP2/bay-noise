# Bay Noise — Rewrite Plan

**Repo:** `github.com/RP2/bay-noise`
**Domain:** `shows.wtf` (stays)
**Display name:** "Bay Noise"
**Tagline:** Your personal Bay Area show radar.

---

## 1. Vision

A mobile-first PWA that acts like a personal show radar. Open it, tell it what genres you're into (via a greeter/onboarding), and get a tailored feed of upcoming Bay Area shows ranked by how much they match your taste. No tabs, no detail pages, no auth. One scrollable feed. An iCal subscription link so shows appear in your calendar app automatically. Simple, fast, installable on your phone.

---

## 2. Architecture Overview

```
┌─────────────────────────────────────────────────────┐
│  DATA PIPELINE (scripts/build-data.js)               │
│                                                      │
│  FooPee "The List"  ──scrape──▶  parse + cleanup     │
│       │                                              │
│       ▼                                              │
│  deduplicate venues + match artists to Spotify       │
│       │                                              │
│       ▼                                              │
│  public/shows.json  (served as /shows.json)           │
│       │                                              │
│       ▼  (git push triggers Pages deploy)            │
└──────────────────────────┬──────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────┐
│  FRONTEND (Preact SPA, typed, tested)                │
│                                                      │
│  index.html → main.tsx → app.tsx                     │
│       │                                              │
│       ▼                                              │
│  Greeter (first visit: pick genres)                  │
│       │                                              │
│       ▼                                              │
│  Personalized show feed (scored by genre match)      │
│       │                                              │
│       ├──▶ "Add to Calendar" per show (ICS download) │
│       └──▶ Subscribe to iCal feed (webcal://)        │
│                                                      │
│  Offline via Service Worker (vite-plugin-pwa)        │
│                                                      │
│  Tests: vitest + happy-dom                           │
└─────────────────────────────────────────────────────┘
```

---

## 3. Data Pipeline — Simplify Everything

**Current:** 4 scripts, 3 intermediate JSON files, ~2,900 lines.

**Proposed:** 1 script, 1 output file.

| Current | New |
|---------|-----|
| `scrape-concerts.js` → raw.json | \_\_\_\_\_\_ |
| `process-databases.js` → artists.json + venues.json | **→ `scripts/build-data.js` → `public/shows.json`** |
| `spotify-verify.js` → enriches artists.json | \_\_\_\_\_\_ |
| `generate-calendar.js` → calendar.json | \_\_\_\_\_\_ |

### What we keep from the existing pipeline:
- FooPee scraping logic (works fine, ~260 lines)
- Venue deduplication (essential for clean data, stripped to essentials)
- Artist name cleanup + non-artist filtering
- Spotify API matching (needed for genre data)

### What we drop:
- Separate `artists.json`, `venues.json`, `raw.json`, `spelling-corrections.json`
- The `generate-calendar.js` and `process-databases.js` separation
- Multi-step workflow complexity

### Output format (`public/shows.json`):

```json
{
  "updated": "2026-07-20",
  "shows": [
    {
      "date": "2026-07-25",
      "day": "Sat Jul 25",
      "venues": [
        {
          "name": "Bottom of the Hill, S.F.",
          "city": "San Francisco",
          "artists": [
            {
              "name": "Sad Snack",
              "genres": ["punk", "indie"],
              "spotifyUrl": "https://..."
            },
            {
              "name": "Opener Band",
              "genres": ["noise"]
            }
            // NOTE: spotifyUrl omitted intentionally — not all artists match Spotify
          ],
          "extra": "9pm $15"
        }
      ]
    }
  ]
}
```

No separate artist/venue indexes — the show list IS the database. Artists and venues are derived from it at render time.

Note: `spotifyUrl` is optional in the `Artist` type. Artists without a Spotify match simply omit the field. The frontend must guard against `undefined` when rendering Spotify links.

---

## 4. Tech Stack

### Chosen for agentic coding

| Layer | Choice | Why |
|-------|--------|-----|
| Framework | **Preact** | Same API as React, 3KB runtime. Types + JSX = AI models write correct component code first time. |
| Language | **TypeScript** | Type constraints prevent hallucinated properties. The `ShowsData`, `ShowDay`, `Venue`, `Artist` types keep every agent on the same page. |
| Styling | **Tailwind v4** | Utility classes are pattern-based. Agent picks classes, doesn't invent CSS names. Zero custom CSS to maintain. |
| Build | **Vite** | Standard, fast, handles TS + JSX + Tailwind + PWA in one pipeline. |
| PWA | **`vite-plugin-pwa`** | ~10 lines config, auto-generates service worker + manifest injection. |
| iCal endpoint | **Cloudflare Pages Function** | One TS file, free tier. |
| Hosting | **Cloudflare Pages** | Free. Static SPA + functions in one deploy. |
| Tests | **Vitest + happy-dom** | Same Vite config, fast, DOM emulation. Tests live next to source files. |

### Why not vanilla JS

Vanilla JS DOM manipulation is underspecified — many correct ways to do the same thing (`innerHTML`, `createElement`, `insertAdjacentHTML`). AI models produce inconsistent patterns. With Preact + TS + Tailwind, the model slots into a well-known pattern every time, reducing back-and-forth fixes.

### Cost

$0 (Cloudflare Pages free tier).

**Total estimated source code:** ~1,500–2,000 lines (vs current ~6,200 + ~2,900 scripts)

---

## 5. Project Structure

```
bay-noise/
├── src/
│   ├── main.tsx                    # Entry point
│   ├── app.tsx                     # App shell (one page router)
│   ├── components/
│   │   ├── greeter.tsx             # Onboarding genre picker
│   │   ├── show-feed.tsx           # Main show list
│   │   ├── show-card.tsx           # Individual show entry
│   │   ├── genre-pill.tsx          # Genre tag
│   │   ├── search-bar.tsx          # Free-text search input
│   │   ├── add-to-calendar.tsx     # Per-event ICS download
│   │   └── feed-subscribe.tsx      # Header iCal subscribe link
│   ├── lib/
│   │   ├── types.ts                # Shared TypeScript types
│   │   ├── genres.ts               # Genre taxonomy + matching
│   │   ├── genres.test.ts
│   │   ├── prefs.ts                # localStorage helpers
│   │   ├── prefs.test.ts
│   │   ├── ics.ts                  # ICS generation (pure fn)
│   │   ├── ics.test.ts
│   │   ├── filter.ts               # Show scoring + filtering
│   │   └── filter.test.ts
│   ├── style.css                   # Tailwind entry + dark mode vars
│   └── vite-env.d.ts
├── functions/
│   └── calendar.ics.ts             # CF Pages Function
├── scripts/
│   └── build-data.js               # Single pipeline script
├── public/
│   ├── shows.json                  # Built by pipeline (tracked in git)
│   ├── venue-aliases.json          # Accumulated venue aliases (tracked)
│   ├── artist-cache.json           # Spotify search cache (tracked)
│   ├── manifest.json
│   ├── icon-192.png
│   ├── icon-512.png
│   └── favicon.svg
├── index.html
├── vite.config.ts
├── tsconfig.json
├── package.json
├── wrangler.jsonc
└── .gitignore
```

### Key conventions for agentic coding

Every file has a single responsibility. Types live in one place (`lib/types.ts`), imported everywhere. Tests mirror source files. This means an AI agent can open `lib/filter.ts`, read the types, and write correct code without guessing the data shape.

---

## 6. Shared Types (`src/lib/types.ts`)

This is the contract every agent and every function works against:

```ts
/** The full data file loaded from shows.json */
export interface ShowsData {
  updated: string;       // ISO date
  shows: ShowDay[];
}

/** A single day with events */
export interface ShowDay {
  date: string;          // YYYY-MM-DD
  day: string;           // "Sat Jul 25"
  venues: VenueEvent[];
}

/** A venue with its artists for that day */
export interface VenueEvent {
  name: string;          // "Bottom of the Hill, S.F."
  city: string | null;   // "San Francisco" | null (if unparseable)
  artists: Artist[];
  extra: string;         // "9pm $15"
}

/** An artist/band */
export interface Artist {
  name: string;
  genres: string[];      // ["punk", "indie"]
  spotifyUrl?: string;
}

/** User genre preferences (stored in localStorage) */
export interface UserPrefs {
  preferredGenres: string[];
  onboarded: boolean;
}

/** A show card ready for rendering (flattened + scored) */
export interface ScoredShow {
  date: string;
  day: string;
  venueName: string;
  city: string | null;   // "San Francisco" | null
  artists: Artist[];
  extra: string;
  score: number;         // genre match score (0 = no match)
}

/** App-level filter state (lives in app.tsx) */
export interface FilterState {
  query: string;          // free-text search
  venue: string | null;   // active venue filter (null = none)
  artist: string | null;  // active artist filter (null = none)
  showAll: boolean;       // bypass genre-scoring fold
}
```

---

## 7. User Flows

### A. First Visit — The Greeter

```
┌─────────────────────────────┐
│                             │
│   What brings you to the    │
│   Bay Area show scene?      │
│                             │
│   Pick the vibes you're into│
│                             │
│   [punk]  [indie]  [metal]  [hiphop]  │
│   [electronic]  [folk]  [jazz]       │
│   [hardcore]  [shoegaze]  [noise]    │
│   [experimental]  [soul]  [hipster]  │
│                             │
│   [▶  Show me what's on]    │
│                             │
│   (prefs saved to           │
│    localStorage forever)    │
│                             │
└─────────────────────────────┘
```

- Single-screen onboarding, tappable genre pills (multi-select)
- Pills are generated from the 13 keys of `GENRE_MAP` in `src/lib/genres.ts` — the list is data-driven, not hand-curated
- User can always revisit via a ⚙️ settings icon in the header

### B. Main Feed (every visit after)

```
┌─────────────────────────────┐
│  🎸 Bay Noise      ⚙️  📡  │
│                             │
│  [🔍 Search shows...      ]│
│                             │
│  "Your upcoming shows"      │
│  (filter: Bottom of the Hill ×)  │
│                             │
│  ╔══════════════════════════╗
│  ║  TOMORROW · Jul 21       ║
│  ║  ★ 2 matches             ║
│  ║                          ║
│  ║  Bottom of the Hill      ║
│  ║  Sad Snack, Foolish      ║
│  ║  Relics                  ║
│  ║  9pm · $15               ║
│  ║  [punk] [indie]          ║
│  ║  [+ Calendar]  [🎵]      ║
│  ╚══════════════════════════╝
│                             │
│  ╔══════════════════════════╗
│  ║  SAT · Jul 26            ║
│  ║  924 Gilman Street       ║
│  ║  3 bands · all ages      ║
│  ║  $10                     ║
│  ║  [hardcore] [punk]       ║
│  ║  [+ Calendar]  [🎵]      ║
│  ╚══════════════════════════╝
│                             │
│      ──── or ────           │
│                             │
│  [Show all upcoming shows ▾] │
└─────────────────────────────┘
```

### Core UX decisions:

- **One scrollable feed** — no tabs, no separate pages
- **Your-genre shows float to top** — scored by genre match, highlighted with a ★ badge
- **Each show card** shows: date, venue (name), artist names, time/price, genre pills, [+ Calendar] button, [🎵 Spotify] links per artist
- **Tap venue name** → filters feed to just that venue's shows (stays in-place, no navigation)
- **Tap artist name** → filters feed to just that artist's shows (stays in-place)
- **"Show all shows"** at bottom to expand beyond genre-matched set
- **Header icons:** ⚙️ redo greeter genres, 📡 iCal subscribe link

---

## 8. Personalization (No Auth, All Client-Side)

| Step | Implementation |
|------|---------------|
| Onboarding | User picks genres → stored in `localStorage['bay-noise-prefs']` |
| Scoring | `filter.ts` → `scoreShow()` iterates artists' genres against `preferredGenres`, returns match count |
| Ranking | `sort()` by `score` descending. Shows with score 0 hidden below a fold |
| Privacy | Nothing leaves the device. No accounts, no backend. |
| Redo | ⚙️ settings cog re-triggers the greeter anytime |

### Genre taxonomy

```ts
// src/lib/genres.ts
// One Spotify genre → exactly one broad category. No overlaps.
// Edge cases documented with comments.
export const GENRE_MAP: Record<string, string[]> = {
  punk: ['punk', 'pop punk', 'skate punk', 'anarcho punk', 'crust punk'],
  indie: ['indie', 'indie rock', 'indie pop', 'indie folk'],
  metal: ['metal', 'death metal', 'black metal', 'doom', 'sludge', 'thrash'],
  hiphop: ['hip hop', 'rap', 'trap', 'underground hip hop', 'boom bap'],
  electronic: ['electronic', 'techno', 'house', 'drum and bass', 'ambient', 'idm'],
  folk: ['folk', 'singer-songwriter', 'americana', 'bluegrass', 'country'],
  jazz: ['jazz', 'free jazz', 'jazz fusion', 'bebop'],
  hardcore: ['hardcore', 'hardcore punk', 'powerviolence', 'beatdown', 'metallic hardcore'],
  shoegaze: ['shoegaze', 'dream pop', 'noise pop', 'ethereal'],
  noise: ['noise', 'noise rock', 'industrial'],
  experimental: ['experimental', 'avant-garde', 'drone', 'minimal', 'free improvisation'],
  soul: ['soul', 'r&b', 'funk', 'neo soul'],
  hipster: ['art rock', 'post-rock', 'math rock', 'chamber pop'],
};
```

Falls back to `"other"` for unclassified artists — those shows still appear but aren't scored up.

---

## 9. Testing Strategy

Tests are **not optional** — they validate that the AI-generated code is correct. Every pure function has a test. Every component has a smoke test.

### What gets tested

| File | Tests what |
|------|-----------|
| `lib/genres.test.ts` | Spotify → broad genre mapping, match scoring |
| `lib/filter.test.ts` | Show filtering by venue/artist/search, sorting, score ranking |
| `lib/ics.test.ts` | Valid ICS output, date formatting (YYYY-MM-DD → DTSTART), character escaping |
| `lib/prefs.test.ts` | localStorage read/write, migration, defaults |
| `components/*.test.tsx` | Each component renders, responds to click, shows/hides |

### How tests run

```bash
npm run test        # vitest (single run)
npm run test:watch  # vitest --watch (dev)
```

Vitest uses the same Vite config, zero extra setup. `happy-dom` emulates the DOM so component tests work without a browser.

### A note on coverage

No minimum coverage target. Tests are written pragmatically — core logic (genre matching, filtering, ICS generation) has thorough tests; UI components have basic render + interaction tests.

---

## 10. PWA Details

| Feature | Implementation |
|---------|---------------|
| Web App Manifest | `public/manifest.json` — theme color, icons (192+512), `display: standalone` |
| Service Worker | `vite-plugin-pwa` generates it — precaches app shell, caches `shows.json` on first fetch via `RuntimeCaching` |
| Install Prompt | Handled by browser's native prompt (Chrome Android, Safari iOS via share sheet) |
| Offline | Full UI works with cached `shows.json`. Shows might be stale but app is functional. |
| Update Strategy | SW checks for updated `shows.json` on each load via `StaleWhileRevalidate` |

---

## 11. iCal Subscription Endpoint

**`functions/calendar.ics.ts`** — Cloudflare Pages Function

- Statically imports `../public/shows.json` at compile time (bundled by esbuild on deploy)
- Generates a valid `.ics` with all upcoming shows as all-day events
- Each event: date (all-day), venue as location, artists in summary
- Returns `Content-Type: text/calendar`
- Subscribe URL: `webcal://shows.wtf/calendar.ics`
- Auto-updates in the user's calendar app when pipeline commits + Pages redeploys

No auth, no user-specific feeds. One public calendar feed.

Plus per-show ICS download buttons (reusing the same `lib/ics.ts` logic client-side).

---

## 12. What We Drop (from current codebase)

| Dropped | Reason |
|---------|--------|
| Artist detail pages (`/artist/[slug].astro`) | Complexity — tap artist name filters feed instead |
| Venue detail pages (`/venue/[slug].astro`) | Same — tap venue name filters feed |
| Day detail pages (`/day/[slug].astro`) | Date is just a heading in the feed |
| Full shadcn/ui library (~12 components) | Don't need most for a simple feed |
| Separate venues.json / artists.json databases | Merged into shows.json |
| Multi-step pipeline (4 scripts) | Single `build-data.js` |
| Spotify verification as separate step | Folded into `build-data.js` inline |
| Spelling corrections system | Replaced by Spotify enrichment + alias accumulation |
| Genre combobox / artist list / venue list components | Replaced by one ShowFeed + ShowCard |
| TabsWrapper, ModeToggle, SortToggle, etc. | No longer needed |
| Astro framework | Replaced by Preact SPA |
| Functions `_middleware.js` | Handled by CF Pages redirects config |
| `.prettierrc` / prettier plugins | Not needed |
| `components.json` (shadcn config) | Not needed |
| Docs directory | Most docs are about the old pipeline |

---

## 13. What We Keep

| Keep | Why |
|------|-----|
| FooPee scraping logic | Data source, works fine |
| isNonArtist filtering | Essential quality control |
| Venue deduplication (simplified) | Clean data |
| Spotify API client | Needed for genre matching |
| Per-event calendar download | Still useful for one-off adds |
| Dark mode | Easy to keep with Tailwind `dark:` |
| Cloudflare Pages deploy | Works, free |
| GitHub Actions monthly cron (first Monday) | Still need data refresh |

---

## 14. Implementation Phases

### Phase 0 — Scaffold + Test Harness (1 hour)
- `npm create vite@latest bay-noise -- --template preact-ts`
- Install `vitest`, `happy-dom`, `@tailwindcss/vite`
- Set up `vite-plugin-pwa`
- Write `lib/types.ts` (shared types, no tests needed)
- Write `lib/ics.test.ts` + `lib/ics.ts` (simple pure function, validates the test harness works)
- **Exit criteria:** `npm test` passes with at least one real test

### Phase 1 — Pipeline (half day)
- Write `scripts/build-data.js` — single script: scrape → process → Spotify genre enrich → output `shows.json`
- Fold Spotify genre matching inline
- Remove old scripts and data files
- Update GitHub Actions workflow to run one script + commit `shows.json`
- **Exit criteria:** `node scripts/build-data.js` produces valid `public/shows.json`

### Phase 2 — Core Logic + Tests (half day)
- `lib/genres.ts` + `lib/genres.test.ts` — genre taxonomy + match scoring
- `lib/filter.ts` + `lib/filter.test.ts` — show flattening, filtering, sorting, search
- `lib/prefs.ts` + `lib/prefs.test.ts` — localStorage read/write, defaults, first-visit detection
- **Exit criteria:** `npm test` passes all core logic tests

### Phase 3 — Components (half day)
- `app.tsx` — loads data, initializes prefs, renders greeter or feed
- `greeter.tsx` — genre pill picker with "Show me what's on" button
- `show-feed.tsx` — scored list with "Show all" toggle, tap-to-filter, clear-filter chip
- `show-card.tsx` — single event card with genre pills, add-to-calendar, spotify buttons
- `search-bar.tsx` — free-text search input in feed header
- `feed-subscribe.tsx` — copies iCal link or opens webcal://
- `genre-pill.tsx` — small colored tag
- **Exit criteria:** App renders correctly with real data, greeter flow works

### Phase 4 — PWA + iCal (few hours)
- Configure `vite-plugin-pwa` with `workbox` runtime caching for `shows.json`
- Write `functions/calendar.ics.ts` Pages Function
- Wire feed-subscribe component to the iCal link
- Wire add-to-calendar component (reuses `lib/ics.ts` from earlier unit)
- **Exit criteria:** App installable on phone, iCal feed subscribable in calendar app

### Phase 5 — Polish + Deploy (half day)
- Dark mode with `class="dark"` + Tailwind `dark:` variants + system preference detection
- Pull-to-refresh (touch event or custom gesture)
- Loading / error / empty states for data fetch
- Write `wrangler.jsonc` for Pages Function deployment
- Deploy to Cloudflare Pages
- Smoke test on mobile + phone home screen install
- **Exit criteria:** `shows.wtf` serves the new app, iCal endpoint returns valid .ics

### Total: ~3 days of solid work

---

## 15. Decisions

1. **Display name:** "Bay Noise"
2. **Update frequency:** First Monday of each month (matching old schedule)
