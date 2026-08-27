import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { readFileSync, mkdtempSync, existsSync, rmSync, readdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

import { extractEntities, type KnownVenue, type ArtistCacheEntry } from "./seo/extract.js";
import type { ShowsData } from "../src/lib/types.js";
import { buildVenuePage, buildArtistPage, buildCityPage } from "./seo/templates.js";
import { buildSitemap, type SitemapEntry } from "./seo/sitemap.js";
import { generateSeoPages } from "./build-seo-pages.js";

const PINNED_NOW = new Date("2026-08-26T20:00:00Z");

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(PINNED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

function loadFixtureData(): {
  data: ShowsData;
  knownVenues: KnownVenue[];
  artistCache: Record<string, ArtistCacheEntry>;
} {
  const data = JSON.parse(readFileSync("public/shows.json", "utf-8")) as ShowsData;
  const knownVenues = JSON.parse(readFileSync("public/known-venues.json", "utf-8")) as KnownVenue[];
  const artistCache = JSON.parse(
    readFileSync("public/artist-cache.json", "utf-8"),
  ) as Record<string, ArtistCacheEntry>;
  return { data, knownVenues, artistCache };
}

describe("orchestrator pipeline (real data)", () => {
  it("extracts venues from real data", () => {
    const { data, knownVenues, artistCache } = loadFixtureData();
    const { venues } = extractEntities(data, knownVenues, artistCache);
    expect(venues.length).toBeGreaterThan(0);
    for (const v of venues) {
      expect(v.slug).toBeTypeOf("string");
      expect(v.slug.length).toBeGreaterThan(0);
      expect(v.shows.length).toBeGreaterThan(0);
    }
  });

  it("extracts artists from real data", () => {
    const { data, knownVenues, artistCache } = loadFixtureData();
    const { artists } = extractEntities(data, knownVenues, artistCache);
    expect(artists.length).toBeGreaterThan(0);
    for (const a of artists) {
      expect(a.slug).toBeTypeOf("string");
      expect(a.slug.length).toBeGreaterThan(0);
      expect(a.shows.length).toBeGreaterThan(0);
    }
  });

  it("extracts cities from real data", () => {
    const { data, knownVenues, artistCache } = loadFixtureData();
    const { cities } = extractEntities(data, knownVenues, artistCache);
    expect(cities.length).toBeGreaterThan(0);
    for (const c of cities) {
      expect(c.slug).toBeTypeOf("string");
      expect(c.slug.length).toBeGreaterThan(0);
      expect(c.shows.length).toBeGreaterThan(0);
    }
  });

  it("generates valid HTML for each venue", () => {
    const { data, knownVenues, artistCache } = loadFixtureData();
    const { venues } = extractEntities(data, knownVenues, artistCache);
    expect(venues.length).toBeGreaterThan(0);
    for (const v of venues) {
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
        updated: v.lastmod,
      });
      expect(html).toContain("<title>");
      expect(html).toContain('type="application/ld+json"');
      expect(html).toContain("</html>");
    }
  });

  it("generates valid HTML for each artist", () => {
    const { data, knownVenues, artistCache } = loadFixtureData();
    const { artists } = extractEntities(data, knownVenues, artistCache);
    expect(artists.length).toBeGreaterThan(0);
    for (const a of artists) {
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
        updated: a.lastmod,
      });
      expect(html).toContain("<title>");
      expect(html).toContain('type="application/ld+json"');
      expect(html).toContain("</html>");
    }
  });

  it("generates valid HTML for each city", () => {
    const { data, knownVenues, artistCache } = loadFixtureData();
    const { cities } = extractEntities(data, knownVenues, artistCache);
    expect(cities.length).toBeGreaterThan(0);
    for (const c of cities) {
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
        updated: c.lastmod,
      });
      expect(html).toContain("<title>");
      expect(html).toContain('type="application/ld+json"');
      expect(html).toContain("</html>");
    }
  });

  it("generates valid sitemap", () => {
    const { data, knownVenues, artistCache } = loadFixtureData();
    const { venues, artists, cities } = extractEntities(data, knownVenues, artistCache);
    const entries: SitemapEntry[] = [
      ...venues.map((v) => ({
        path: `/venue/${v.slug}/`,
        lastmod: v.lastmod,
        priority: 0.7,
        changefreq: "weekly",
      })),
      ...artists.map((a) => ({
        path: `/artist/${a.slug}/`,
        lastmod: a.lastmod,
        priority: 0.6,
        changefreq: "weekly",
      })),
      ...cities.map((c) => ({
        path: `/city/${c.slug}/`,
        lastmod: c.lastmod,
        priority: 0.7,
        changefreq: "weekly",
      })),
    ];
    const xml = buildSitemap(entries);
    expect(xml).toMatch(/^<\?xml/);
    expect(xml).toContain("<loc>https://shows.wtf/</loc>");
    expect(xml).toContain("</urlset>");
  });

  it("no slug collisions in orchestrator output", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "seo-collision-"));
    try {
      generateSeoPages(outputDir);
      const slugs = new Set<string>();
      const collisions: string[] = [];
      const check = (parent: string, slug: string) => {
        if (slugs.has(slug)) {
          collisions.push(`slug "${slug}" appears under multiple parents (saw ${parent})`);
        } else {
          slugs.add(slug);
        }
      };
      for (const type of ["venue", "artist", "city"] as const) {
        const dir = join(outputDir, type);
        if (!existsSync(dir)) continue;
        for (const entry of readdirSync(dir)) {
          if (entry === "index.html") continue;
          check(type, entry);
        }
      }
      expect(collisions).toEqual([]);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});

describe("orchestrator file I/O", () => {
  it("writes files to dist/ (via temp dir)", () => {
    const { data, knownVenues, artistCache } = loadFixtureData();
    const { venues, artists, cities } = extractEntities(data, knownVenues, artistCache);
    expect(venues.length + artists.length + cities.length).toBeGreaterThan(0);

    const outputDir = mkdtempSync(join(tmpdir(), "seo-test-"));
    try {
      generateSeoPages(outputDir);

      expect(existsSync(join(outputDir, "sitemap.xml"))).toBe(true);

      const venueDir = join(outputDir, "venue");
      if (existsSync(venueDir)) {
        const venueEntries = readdirSync(venueDir).filter((e) => e !== "index.html");
        expect(venueEntries.length).toBe(venues.length);
        const firstVenue = venues[0]!;
        const venueFile = join(venueDir, firstVenue.slug, "index.html");
        expect(existsSync(venueFile)).toBe(true);
        const html = readFileSync(venueFile, "utf-8");
        expect(html).toContain("<title>");
        expect(html).toContain("</html>");
      }

      const artistDir = join(outputDir, "artist");
      if (existsSync(artistDir) && artists.length > 0) {
        const firstArtist = artists[0]!;
        const artistFile = join(artistDir, firstArtist.slug, "index.html");
        expect(existsSync(artistFile)).toBe(true);
      }

      const cityDir = join(outputDir, "city");
      if (existsSync(cityDir) && cities.length > 0) {
        const firstCity = cities[0]!;
        const cityFile = join(cityDir, firstCity.slug, "index.html");
        expect(existsSync(cityFile)).toBe(true);
      }

      const sitemapPath = join(outputDir, "sitemap.xml");
      const sitemap = readFileSync(sitemapPath, "utf-8");
      expect(sitemap).toMatch(/^<\?xml/);
      expect(sitemap).toContain("<loc>https://shows.wtf/</loc>");
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });

  it("writes index pages for venue, artist, and city", () => {
    const outputDir = mkdtempSync(join(tmpdir(), "seo-index-"));
    try {
      generateSeoPages(outputDir);

      const venueIndex = join(outputDir, "venue", "index.html");
      expect(existsSync(venueIndex)).toBe(true);
      const venueHtml = readFileSync(venueIndex, "utf-8");
      expect(venueHtml).toContain("<title>");
      expect(venueHtml).toContain('rel="canonical" href="https://shows.wtf/venue/"');
      expect(venueHtml).toContain('<ul class="index-list">');
      expect(venueHtml).toMatch(/<a href="\/venue\/[a-z0-9-]+\//);

      const artistIndex = join(outputDir, "artist", "index.html");
      expect(existsSync(artistIndex)).toBe(true);
      const artistHtml = readFileSync(artistIndex, "utf-8");
      expect(artistHtml).toContain('rel="canonical" href="https://shows.wtf/artist/"');
      expect(artistHtml).toMatch(/<a href="\/artist\/[a-z0-9-]+\//);

      const cityIndex = join(outputDir, "city", "index.html");
      expect(existsSync(cityIndex)).toBe(true);
      const cityHtml = readFileSync(cityIndex, "utf-8");
      expect(cityHtml).toContain('rel="canonical" href="https://shows.wtf/city/"');
      expect(cityHtml).toMatch(/<a href="\/city\/[a-z0-9-]+\//);
    } finally {
      rmSync(outputDir, { recursive: true, force: true });
    }
  });
});
