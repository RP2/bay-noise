/**
 * Bay Noise — SEO static page orchestrator
 *
 * Reads public/shows.json + public/known-venues.json + public/artist-cache.json,
 * extracts venue/artist/city entities, and writes pre-rendered HTML pages
 * (with sitemap.xml) to the output directory.
 *
 * Pure work lives in scripts/seo/{extract,templates,sitemap}.ts. This file
 * is the only place that touches the filesystem.
 *
 * Usage: npx tsx scripts/build-seo-pages.ts
 *   → writes to ./dist
 *
 * Exported for tests: generateSeoPages(outputDir)
 */

import { readFileSync, mkdirSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { fileURLToPath } from "url";

import { extractEntities, type KnownVenue, type ArtistCacheEntry } from "./seo/extract.js";
import type { ShowsData } from "../src/lib/types.js";
import { buildVenuePage, buildArtistPage, buildCityPage, buildIndexPage } from "./seo/templates.js";
import { buildSitemap, type SitemapEntry } from "./seo/sitemap.js";

const PUBLIC_DIR = "public";
const SHOWS_PATH = join(PUBLIC_DIR, "shows.json");
const KNOWN_VENUES_PATH = join(PUBLIC_DIR, "known-venues.json");
const ARTIST_CACHE_PATH = join(PUBLIC_DIR, "artist-cache.json");

// Sitemap tuning per the seo plan: venues/cities get 0.7, artists 0.6 (artists
// are leaf entities, less navigational weight), all "weekly" since shows
// update nightly but per-page content churns on a week-scale.
const SITEMAP_PRIORITIES = { venue: 0.7, artist: 0.6, city: 0.7 } as const;
const SITEMAP_CHANGEFREQ = "weekly";

/**
 * Generate all SEO pages from public/* and write them to `outputDir`.
 *
 * Layout:
 *   <outputDir>/venue/<slug>/index.html
 *   <outputDir>/artist/<slug>/index.html
 *   <outputDir>/city/<slug>/index.html
 *   <outputDir>/sitemap.xml
 *
 * Exits the process if public/shows.json is missing (treats it as a fatal
 * pre-condition — the rest of the pipeline depends on it).
 */
export function generateSeoPages(outputDir: string): void {
  for (const [, filePath] of [
    ["shows.json", SHOWS_PATH],
    ["known-venues.json", KNOWN_VENUES_PATH],
    ["artist-cache.json", ARTIST_CACHE_PATH],
  ] as const) {
    if (!existsSync(filePath)) {
      console.error(`FATAL: ${filePath} not found. Run \`npm run pipeline\` first.`);
      process.exit(1);
    }
  }

  let data: ShowsData;
  let knownVenues: KnownVenue[];
  let artistCache: Record<string, ArtistCacheEntry>;
  try {
    data = JSON.parse(readFileSync(SHOWS_PATH, "utf-8")) as ShowsData;
    knownVenues = JSON.parse(readFileSync(KNOWN_VENUES_PATH, "utf-8")) as KnownVenue[];
    artistCache = JSON.parse(readFileSync(ARTIST_CACHE_PATH, "utf-8")) as Record<string, ArtistCacheEntry>;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(`FATAL: failed to read or parse input JSON: ${msg}\nRun \`npm run pipeline\` to regenerate.`);
    process.exit(1);
  }

  const { venues, artists, cities } = extractEntities(data, knownVenues, artistCache);

  // Slug-collision guard: each entity type has its own namespace because
  // pages live in separate directories (`dist/venue/<slug>/` vs
  // `dist/artist/<slug>/`), so a venue slug "foo" and an artist slug "foo"
  // are not actually in conflict. A shared set would silently drop pages.
  // `written` tracks only the entities we successfully rendered — sitemap
  // must omit skipped ones.
  const claimedVenueSlugs = new Set<string>();
  const claimedArtistSlugs = new Set<string>();
  const claimedCitySlugs = new Set<string>();
  const written = new Set<string>();
  const skip = (
    claimed: Set<string>,
    type: string,
    name: string,
    slug: string,
  ): boolean => {
    if (claimed.has(slug)) {
      console.warn(`  ! ${type} "${name}" skipped — slug "${slug}" already in use`);
      return true;
    }
    claimed.add(slug);
    return false;
  };

  let venueCount = 0;
  for (const v of venues) {
    if (skip(claimedVenueSlugs, "venue", v.name, v.slug)) continue;
    const html = buildVenuePage({
      name: v.name,
      slug: v.slug,
      city: v.city,
      address: v.address,
      shows: v.shows.map((s) => ({
        date: s.date,
        day: s.day,
        extra: s.extra,
        time: s.time,
        price: s.price,
        age: s.age,
        artists: s.artists,
      })),
      updated: data.updated,
    });
    const dir = join(outputDir, "venue", v.slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.html"), html);
    written.add(v.slug);
    venueCount++;
  }

  let artistCount = 0;
  for (const a of artists) {
    if (skip(claimedArtistSlugs, "artist", a.name, a.slug)) continue;
    const html = buildArtistPage({
      name: a.name,
      slug: a.slug,
      genres: a.genres,
      spotifyUrl: a.spotifyUrl,
      shows: a.shows.map((s) => ({
        date: s.date,
        day: s.day,
        extra: s.extra,
        time: s.time,
        price: s.price,
        age: s.age,
        venueName: s.venueName,
        venueSlug: s.venueSlug,
        city: s.city,
        address: s.address,
        artists: s.artists,
      })),
      updated: data.updated,
    });
    const dir = join(outputDir, "artist", a.slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.html"), html);
    written.add(a.slug);
    artistCount++;
  }

  let cityCount = 0;
  for (const c of cities) {
    if (skip(claimedCitySlugs, "city", c.name, c.slug)) continue;
    const html = buildCityPage({
      name: c.name,
      slug: c.slug,
      shows: c.shows.map((s) => ({
        date: s.date,
        day: s.day,
        extra: s.extra,
        time: s.time,
        price: s.price,
        age: s.age,
        venueName: s.venueName,
        venueSlug: s.venueSlug,
        city: s.city,
        address: s.address,
        artists: s.artists,
      })),
      updated: data.updated,
    });
    const dir = join(outputDir, "city", c.slug);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.html"), html);
    written.add(c.slug);
    cityCount++;
  }

  const sitemapEntries: SitemapEntry[] = [
    ...venues.filter((v) => written.has(v.slug)).map((v) => ({
      path: `/venue/${v.slug}/`,
      lastmod: data.updated,
      priority: SITEMAP_PRIORITIES.venue,
      changefreq: SITEMAP_CHANGEFREQ,
    })),
    ...artists.filter((a) => written.has(a.slug)).map((a) => ({
      path: `/artist/${a.slug}/`,
      lastmod: data.updated,
      priority: SITEMAP_PRIORITIES.artist,
      changefreq: SITEMAP_CHANGEFREQ,
    })),
    ...cities.filter((c) => written.has(c.slug)).map((c) => ({
      path: `/city/${c.slug}/`,
      lastmod: data.updated,
      priority: SITEMAP_PRIORITIES.city,
      changefreq: SITEMAP_CHANGEFREQ,
    })),
  ];

  const sitemap = buildSitemap(sitemapEntries, data.updated);
  mkdirSync(outputDir, { recursive: true });
  writeFileSync(join(outputDir, "sitemap.xml"), sitemap);

  // Build entries from the written set, deduping by slug (the artists array
  // can contain multiple entries with the same slug due to variant grouping;
  // only one page per slug is written).
  const venueBySlug = new Map(venues.map((v) => [v.slug, v]));
  const artistBySlug = new Map(artists.map((a) => [a.slug, a]));
  const cityBySlug = new Map(cities.map((c) => [c.slug, c]));

  const venueIndexHtml = buildIndexPage({
    title: "All Venues",
    slug: "venue",
    description: `Browse all ${venueCount} Bay Area music venues on Bay Noise. Find upcoming live shows by venue, with dates, artists, and tickets.`,
    entries: [...written].filter((s) => venueBySlug.has(s)).map((s) => {
      const v = venueBySlug.get(s)!;
      return { name: v.name, slug: v.slug, subtitle: v.city ?? undefined };
    }),
  });
  const venueIndexDir = join(outputDir, "venue");
  mkdirSync(venueIndexDir, { recursive: true });
  writeFileSync(join(venueIndexDir, "index.html"), venueIndexHtml);

  const artistIndexHtml = buildIndexPage({
    title: "All Artists",
    slug: "artist",
    description: `Browse all ${artistCount} Bay Area artists on Bay Noise. Find upcoming live shows by artist, with dates, venues, and tickets.`,
    entries: [...written].filter((s) => artistBySlug.has(s)).map((s) => {
      const a = artistBySlug.get(s)!;
      return { name: a.name, slug: a.slug };
    }),
  });
  const artistIndexDir = join(outputDir, "artist");
  mkdirSync(artistIndexDir, { recursive: true });
  writeFileSync(join(artistIndexDir, "index.html"), artistIndexHtml);

  const cityIndexHtml = buildIndexPage({
    title: "All Cities",
    slug: "city",
    description: `Browse all ${cityCount} Bay Area cities with upcoming live music on Bay Noise. Find shows by city, with dates, venues, and artists.`,
    entries: [...written].filter((s) => cityBySlug.has(s)).map((s) => {
      const c = cityBySlug.get(s)!;
      return { name: c.name, slug: c.slug };
    }),
  });
  const cityIndexDir = join(outputDir, "city");
  mkdirSync(cityIndexDir, { recursive: true });
  writeFileSync(join(cityIndexDir, "index.html"), cityIndexHtml);

  console.log(
    `✓ Generated ${venueCount} venue pages, ${artistCount} artist pages, ${cityCount} city pages`,
  );
}

function main(): void {
  console.log("=== Building SEO pages ===");
  generateSeoPages("dist");
  console.log("=== Done ===");
}

// Run main() only when this file is invoked directly, not when imported by
// tests. `tsx` and `node` both set process.argv[1] to the script's path.
// Use `endsWith` to handle relative-vs-absolute path mismatches.
const isDirectInvocation =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url).endsWith(process.argv[1]);

if (isDirectInvocation) {
  main();
}
