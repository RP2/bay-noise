/**
 * Bay Noise — SEO static page templates
 *
 * Pure module: builds self-contained HTML strings for venue/artist/city
 * landing pages. No file I/O, no side effects. All dynamic text content
 * passes through escapeHtml; JSON-LD is JSON.stringify'd (safe inside a
 * <script> element per the plan §4.4).
 *
 * Invoked by scripts/build-seo-pages.ts (the orchestrator), which is the
 * only file allowed to read or write files.
 */

interface ArtistRef {
  name: string;
  genres: string[];
  slug: string;
}

interface ShowCommon {
  date: string;
  day: string;
  extra: string;
  time: string | null;
  price: string | null;
  age: string | null;
}

interface VenueShowEntry extends ShowCommon {
  artists: ArtistRef[];
}

interface ArtistShowEntry extends ShowCommon {
  venueName: string;
  venueSlug: string;
  city: string | null;
  address: string | null;
  artists: ArtistRef[];
}

interface CityShowEntry extends ShowCommon {
  venueName: string;
  venueSlug: string;
  city: string | null;
  address: string | null;
  artists: ArtistRef[];
}

// NOTE(port): INLINE_CSS values mirror the app's Tailwind tokens
// (bg-neutral-950, text-neutral-100, neutral-400, neutral-700) — plan §4.2.
// Max width 42rem matches the app's max-w-2xl. No responsive breakpoints —
// SEO billboards are single-column, readable on any device.
const INLINE_CSS = `* { box-sizing: border-box; }
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
.show .artists a { color: #e5e5e5; text-decoration: underline; text-decoration-color: #525252; }
.show .artists a:hover { text-decoration-color: #f5f5f5; }
.show .genres { color: #737373; font-size: .85rem; }
.show .venue { color: #d4d4d4; }
.show .venue a { color: #e5e5e5; text-decoration: underline; text-decoration-color: #525252; }
.show .venue a:hover { text-decoration-color: #f5f5f5; }
.cta {
  display: inline-block; margin-top: 2rem; padding: .6rem 1rem;
  border: 1px solid #404040; text-decoration: none; font-weight: 600;
}
.cta:hover { border-color: #f5f5f5; }
.site-footer {
  border-top: 1px solid #262626; text-align: center; padding: 1.5rem 1rem;
  color: #737373; font-size: .8rem;
}`;

const SITE_NAME = "Bay Noise";
const SITE_URL = "https://shows.wtf";
const OG_IMAGE = `${SITE_URL}/icon-512.png`;
// NOTE(port): CTA copy is fixed across all three page types per plan §2.7
// ("Browse all Bay Area shows →"). The arrow is U+2192.
const CTA_TEXT = "Browse all Bay Area shows \u2192";
// NOTE(port): 50-show cap enforced here defensively, even though extract.ts
// also caps (plan §2.10). Defense in depth: a future caller that forgets to
// cap still produces a page under Google's ~100KB guidance.
const MAX_SHOWS_PER_PAGE = 50;

const FOOTER_HTML = `Bay Noise \u2014 your personal Bay Area show radar \u00b7 <a href="${SITE_URL}">shows.wtf</a>`;

/**
 * Escape characters that have special meaning in HTML so dynamic text can
 * be safely inlined into text and attribute positions. JSON-LD is handled
 * separately via JSON.stringify (safe inside a <script> element).
 */
export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function joinNonNull(parts: Array<string | null | undefined>, sep = " \u00b7 "): string {
  return parts.filter((p): p is string => Boolean(p)).join(sep);
}

function renderShowInfo(show: ShowCommon): string {
  return joinNonNull([show.time, show.price, show.age]);
}

function renderArtistsList(artists: ArtistRef[]): string {
  if (!artists.length) return "";
  const items = artists.map((a) => {
    const genres = a.genres.length
      ? ` <span class="genres">(${escapeHtml(a.genres.join(", "))})</span>`
      : "";
    return `<li><a href="/artist/${escapeHtml(a.slug)}/">${escapeHtml(a.name)}</a>${genres}</li>`;
  }).join("");
  return `<ul class="artists">${items}</ul>`;
}

function renderVenueShowArticle(show: VenueShowEntry): string {
  return `<article class="show">
  <div class="date">${escapeHtml(show.day)}</div>
  <div class="info">${escapeHtml(renderShowInfo(show))}</div>
  ${renderArtistsList(show.artists)}
</article>`;
}

function renderArtistShowArticle(show: ArtistShowEntry): string {
  // NOTE(port): For artist pages, callers (extract.ts) are expected to pass
  // the list of OTHER artists on the bill — the page's subject is rendered
  // in <h1> and the event name, not in the per-show artist list. We render
  // whatever the caller provides.
  const cityPart = show.city ? `, ${escapeHtml(show.city)}` : "";
  return `<article class="show">
  <div class="date">${escapeHtml(show.day)}</div>
  <div class="venue"><a href="/venue/${escapeHtml(show.venueSlug)}/">${escapeHtml(show.venueName)}</a>${cityPart}</div>
  <div class="info">${escapeHtml(renderShowInfo(show))}</div>
  ${renderArtistsList(show.artists)}
</article>`;
}

function renderCityShowArticle(show: CityShowEntry): string {
  return `<article class="show">
  <div class="date">${escapeHtml(show.day)}</div>
  <div class="venue"><a href="/venue/${escapeHtml(show.venueSlug)}/">${escapeHtml(show.venueName)}</a></div>
  <div class="info">${escapeHtml(renderShowInfo(show))}</div>
  ${renderArtistsList(show.artists)}
</article>`;
}

interface HeadOptions {
  title: string;
  description: string;
  canonicalUrl: string;
  ogType: "website" | "profile" | "article";
  jsonLd: unknown;
}

function renderHead(opts: HeadOptions): string {
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="theme-color" content="#000000">
  <meta name="color-scheme" content="dark">
  <title>${escapeHtml(opts.title)}</title>
  <meta name="description" content="${escapeHtml(opts.description)}">
  <link rel="canonical" href="${escapeHtml(opts.canonicalUrl)}">
  <link rel="icon" type="image/svg+xml" href="/favicon.svg">

  <!-- Open Graph -->
  <meta property="og:title" content="${escapeHtml(opts.title)}">
  <meta property="og:description" content="${escapeHtml(opts.description)}">
  <meta property="og:type" content="${escapeHtml(opts.ogType)}">
  <meta property="og:url" content="${escapeHtml(opts.canonicalUrl)}">
  <meta property="og:site_name" content="${escapeHtml(SITE_NAME)}">
  <meta property="og:image" content="${escapeHtml(OG_IMAGE)}">

  <!-- Twitter -->
  <meta name="twitter:card" content="summary">
  <meta name="twitter:title" content="${escapeHtml(opts.title)}">
  <meta name="twitter:description" content="${escapeHtml(opts.description)}">
  <meta name="twitter:image" content="${escapeHtml(OG_IMAGE)}">

  <!-- Structured data -->
  <script type="application/ld+json">${JSON.stringify(opts.jsonLd).replace(/</g, "\\u003c")}</script>

  <style>${INLINE_CSS}</style>
</head>
<body>
  <header class="site-header"><a href="/" class="brand">${escapeHtml(SITE_NAME)}</a></header>
  <main>`;
}

function renderShell(opts: { h1: string; metaLine: string; showArticles: string }): string {
  return `    <h1>${escapeHtml(opts.h1)}</h1>
    <p class="meta">${opts.metaLine}</p>
    <section class="shows">
      <h2>Upcoming shows</h2>
      ${opts.showArticles}
    </section>
    <a class="cta" href="/">${escapeHtml(CTA_TEXT)}</a>
  </main>
  <footer class="site-footer">
    ${FOOTER_HTML}
  </footer>
</body>
</html>
`;
}

function buildAddress(city: string | null, address: string | null): Record<string, string> | null {
  // PostalAddress requires at least one address field per schema.org. If
  // both streetAddress and addressLocality are absent, omit the wrapper.
  if (!city && !address) return null;
  const out: Record<string, string> = { "@type": "PostalAddress", addressCountry: "US" };
  if (address) out.streetAddress = address;
  if (city) out.addressLocality = city;
  return out;
}

function venueEventName(show: VenueShowEntry, venueName: string): string {
  const names = show.artists.map((a) => a.name);
  return names.length ? `${names.join(", ")} at ${venueName}` : `Show at ${venueName}`;
}

function artistEventName(show: ArtistShowEntry, artistName: string): string {
  return `${artistName} at ${show.venueName}`;
}

function cityEventName(show: CityShowEntry): string {
  const names = show.artists.map((a) => a.name);
  return names.length ? `${names.join(", ")} at ${show.venueName}` : `Show at ${show.venueName}`;
}

/** Build a complete venue page HTML string. */
export function buildVenuePage(opts: {
  name: string;
  slug: string;
  city: string | null;
  address: string | null;
  shows: VenueShowEntry[];
  updated: string;
}): string {
  const shows = opts.shows.slice(0, MAX_SHOWS_PER_PAGE);
  const title = `Upcoming shows at ${opts.name} \u2014 Bay Noise`;
  const cityClause = opts.city ? ` in ${opts.city}` : "";
  const description = `See upcoming live shows at ${opts.name}${cityClause}. Dates, times, prices, and artists. Updated ${opts.updated}.`;
  const canonicalUrl = `${SITE_URL}/venue/${opts.slug}/`;
  const metaLine = joinNonNull([opts.city, opts.address]);
  const articles = shows.map(renderVenueShowArticle).join("\n    ");

  const address = buildAddress(opts.city, opts.address);
  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "Place",
    name: opts.name,
  };
  if (address) ld.address = address;
  ld.event = shows.map((s) => {
    const ev: Record<string, unknown> = {
      "@type": "Event",
      name: venueEventName(s, opts.name),
      startDate: s.date,
    };
    if (s.artists.length) {
      ev.performer = s.artists.map((a) => ({
        "@type": "MusicGroup",
        name: a.name,
        url: `${SITE_URL}/artist/${a.slug}/`,
      }));
    }
    return ev;
  });

  return (
    renderHead({ title, description, canonicalUrl, ogType: "website", jsonLd: ld })
    + renderShell({ h1: opts.name, metaLine: escapeHtml(metaLine), showArticles: articles })
  );
}

/** Build a complete artist page HTML string. */
export function buildArtistPage(opts: {
  name: string;
  slug: string;
  genres: string[];
  spotifyUrl: string | undefined;
  shows: ArtistShowEntry[];
  updated: string;
}): string {
  const shows = opts.shows.slice(0, MAX_SHOWS_PER_PAGE);
  const title = `Upcoming shows for ${opts.name} \u2014 Bay Noise`;
  const description = `See upcoming Bay Area shows featuring ${opts.name}. Dates, venues, and tickets. Updated ${opts.updated}.`;
  const canonicalUrl = `${SITE_URL}/artist/${opts.slug}/`;
  const articles = shows.map(renderArtistShowArticle).join("\n    ");

  const metaParts: string[] = [];
  if (opts.genres.length) {
    metaParts.push(escapeHtml(opts.genres.join(", ")));
  }
  if (opts.spotifyUrl) {
    metaParts.push(`<a href="${escapeHtml(opts.spotifyUrl)}" rel="noopener">Spotify</a>`);
  }
  const metaLine = metaParts.join(" \u00b7 ");

  const ld: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "MusicGroup",
    name: opts.name,
  };
  if (opts.genres.length) ld.genre = opts.genres;
  ld.event = shows.map((s) => {
    const location: Record<string, unknown> = {
      "@type": "Place",
      name: s.venueName,
      url: `${SITE_URL}/venue/${s.venueSlug}/`,
    };
    const addr = buildAddress(s.city, s.address);
    if (addr) location.address = addr;
    return {
      "@type": "Event",
      name: artistEventName(s, opts.name),
      startDate: s.date,
      location,
    };
  });

  return (
    renderHead({ title, description, canonicalUrl, ogType: "profile", jsonLd: ld })
    + renderShell({ h1: opts.name, metaLine, showArticles: articles })
  );
}

/** Build a complete city page HTML string. */
export function buildCityPage(opts: {
  name: string;
  slug: string;
  shows: CityShowEntry[];
  updated: string;
}): string {
  const shows = opts.shows.slice(0, MAX_SHOWS_PER_PAGE);
  const title = `Upcoming live shows in ${opts.name} \u2014 Bay Noise`;
  const description = `Browse upcoming live music and shows in ${opts.name}. Venues, dates, artists, and tickets. Updated ${opts.updated}.`;
  const canonicalUrl = `${SITE_URL}/city/${opts.slug}/`;
  const articles = shows.map(renderCityShowArticle).join("\n    ");
  const uniqueVenues = new Set(shows.map((s) => s.venueName));
  const metaLine = `${shows.length} upcoming show${shows.length === 1 ? "" : "s"} across ${uniqueVenues.size} venue${uniqueVenues.size === 1 ? "" : "s"}`;

  // NOTE(port): City JSON-LD is a flat array of Event objects — schema.org
  // has no top-level "City" type, and a wrapping ItemPage would require
  // repeating every Event in a hasPart array. The page subject (the city)
  // is implicit in the URL and the @context.
  const ld = shows.map((s) => {
    const location: Record<string, unknown> = {
      "@type": "Place",
      name: s.venueName,
      url: `${SITE_URL}/venue/${s.venueSlug}/`,
    };
    const addr = buildAddress(s.city, s.address);
    if (addr) location.address = addr;
    return {
      "@context": "https://schema.org",
      "@type": "Event",
      name: cityEventName(s),
      startDate: s.date,
      location,
    };
  });

  return (
    renderHead({ title, description, canonicalUrl, ogType: "website", jsonLd: ld })
    + renderShell({ h1: `Live shows in ${opts.name}`, metaLine: escapeHtml(metaLine), showArticles: articles })
  );
}
