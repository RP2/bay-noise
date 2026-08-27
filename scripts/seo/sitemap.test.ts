import { describe, it, expect } from "vitest";
import { buildSitemap } from "./sitemap.js";
import type { SitemapEntry } from "./sitemap.js";

function venue(slug: string, lastmod = "2026-08-01"): SitemapEntry {
  return { path: `/venue/${slug}/`, lastmod, priority: 0.7, changefreq: "weekly" };
}

function artist(slug: string, lastmod = "2026-08-01"): SitemapEntry {
  return { path: `/artist/${slug}/`, lastmod, priority: 0.6, changefreq: "weekly" };
}

function city(slug: string, lastmod = "2026-08-01"): SitemapEntry {
  return { path: `/city/${slug}/`, lastmod, priority: 0.7, changefreq: "weekly" };
}

describe("buildSitemap", () => {
  it("starts with an XML declaration", () => {
    const xml = buildSitemap([]);
    expect(xml).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
  });

  it("contains <urlset> open and close tags", () => {
    const xml = buildSitemap([]);
    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain("</urlset>");
  });

  it("includes homepage as the first entry with priority 1.0 and daily changefreq", () => {
    const xml = buildSitemap([venue("alpha")]);
    const firstUrl = xml.match(/<url>[\s\S]*?<\/url>/)?.[0] ?? "";
    expect(firstUrl).toContain("<loc>https://shows.wtf/</loc>");
    expect(firstUrl).toContain("<priority>1.0</priority>");
    expect(firstUrl).toContain("<changefreq>daily</changefreq>");
  });

  it("homepage is always first even when entries sort before it", () => {
    const entries = [artist("aaa"), venue("zzz")];
    const xml = buildSitemap(entries);
    const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
    expect(locs[0]).toBe("https://shows.wtf/");
  });

  it("renders venue entry with priority 0.7 and weekly changefreq", () => {
    const xml = buildSitemap([venue("bottom-of-the-hill")]);
    expect(xml).toContain("<loc>https://shows.wtf/venue/bottom-of-the-hill/</loc>");
    expect(xml).toContain("<priority>0.7</priority>");
    expect(xml).toContain("<changefreq>weekly</changefreq>");
  });

  it("renders artist entry with priority 0.6 and weekly changefreq", () => {
    const xml = buildSitemap([artist("sad-snack")]);
    expect(xml).toContain("<loc>https://shows.wtf/artist/sad-snack/</loc>");
    expect(xml).toContain("<priority>0.6</priority>");
    expect(xml).toContain("<changefreq>weekly</changefreq>");
  });

  it("renders city entry with priority 0.7 and weekly changefreq", () => {
    const xml = buildSitemap([city("san-francisco")]);
    expect(xml).toContain("<loc>https://shows.wtf/city/san-francisco/</loc>");
    expect(xml).toContain("<priority>0.7</priority>");
    expect(xml).toContain("<changefreq>weekly</changefreq>");
  });

  it("escapes & in URLs to &amp;", () => {
    const entry: SitemapEntry = {
      path: "/venue/rock-&-roll/",
      lastmod: "2026-08-01",
      priority: 0.7,
      changefreq: "weekly",
    };
    const xml = buildSitemap([entry]);
    expect(xml).toContain("https://shows.wtf/venue/rock-&amp;-roll/");
    expect(xml).not.toMatch(/rock-&[^a]/);
  });

  it("sorts entries alphabetically by path after homepage", () => {
    const entries = [venue("zzz"), artist("aaa"), city("mmm")];
    const xml = buildSitemap(entries);
    const locs = [...xml.matchAll(/<loc>(.*?)<\/loc>/g)].map((m) => m[1]);
    expect(locs).toEqual([
      "https://shows.wtf/",
      "https://shows.wtf/artist/aaa/",
      "https://shows.wtf/city/mmm/",
      "https://shows.wtf/venue/zzz/",
    ]);
  });

  it("uses the latest entry lastmod for the homepage", () => {
    const entries = [venue("a", "2026-06-01"), artist("b", "2026-08-15")];
    const xml = buildSitemap(entries);
    const firstUrl = xml.match(/<url>[\s\S]*?<\/url>/)?.[0] ?? "";
    expect(firstUrl).toContain("<lastmod>2026-08-15</lastmod>");
  });

  it("uses explicit homepageLastmod when provided", () => {
    const entries = [venue("a", "2026-12-31")];
    const xml = buildSitemap(entries, "2026-08-24");
    const firstUrl = xml.match(/<url>[\s\S]*?<\/url>/)?.[0] ?? "";
    expect(firstUrl).toContain("<lastmod>2026-08-24</lastmod>");
  });

  it("produces valid XML structure with matching open/close tags", () => {
    const xml = buildSitemap([venue("test")]);
    const openCount = (xml.match(/<url>/g) ?? []).length;
    const closeCount = (xml.match(/<\/url>/g) ?? []).length;
    expect(openCount).toBe(closeCount);
    expect(openCount).toBe(2);
  });
});
