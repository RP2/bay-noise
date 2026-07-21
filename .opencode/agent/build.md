# Bay Noise — Build Rules

## Stack: Preact SPA + Vite + Tailwind v4 + Cloudflare Pages + Node pipeline

### Preact / Vite
- Use `h()` from preact, JSX via `@preact/preset-vite`
- `import { h } from 'preact'` — never `import React from 'react'`
- `useState`, `useEffect`, `useCallback` from `preact/hooks`
- `@testing-library/preact` + `vitest` + `happy-dom` for tests
- `vite-plugin-pwa` for service worker — never write SW manually

### Tailwind v4
- Utility classes only. `style.css` = `@import "tailwindcss"` + dark mode vars
- Dark mode: `class="dark"` on `<html>`, `dark:` variants in templates

### Cloudflare Pages
- Functions in `functions/` directory, one `.ts` file per route
- Pages Functions use standard Request/Response API
- `wrangler.jsonc` for deployment configuration (separate from vite)
- No `node-fetch` — Node 22 native `fetch()` in pipeline

### Pipeline (Node.js)
- `scripts/build-data.js` — single file, clearly sectioned
- `cheerio` for HTML parsing of foopee.com pages
- Spotify Client Credentials flow with env vars `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`
- Venue dedup: strip city suffix → normalize → exact match only
- Artist enrichment: normalize → Spotify search → cache in `public/artist-cache.json`

### Data files (tracked in git)
- `public/shows.json` — single source of truth, produced by pipeline
- `public/venue-aliases.json` — accumulated venue alias state
- `public/artist-cache.json` — Spotify search cache
