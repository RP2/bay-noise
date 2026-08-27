export interface SitemapEntry {
  path: string;
  lastmod: string;
  priority: number;
  changefreq: string;
}

const SITE_BASE = "https://shows.wtf";

// NOTE(port): Homepage lastmod is derived as the max of all entry lastmods.
function escapeXml(s: string): string {
  return s.replace(/&/g, "&amp;");
}

function maxLastmod(entries: SitemapEntry[]): string {
  if (entries.length === 0) return new Date().toISOString().slice(0, 10);
  return entries.reduce((max, e) => (e.lastmod > max ? e.lastmod : max), entries[0].lastmod);
}

function urlBlock(loc: string, lastmod: string, changefreq: string, priority: number): string {
  const prio = priority.toFixed(1);
  return [
    "  <url>",
    `    <loc>${escapeXml(loc)}</loc>`,
    `    <lastmod>${lastmod}</lastmod>`,
    `    <changefreq>${changefreq}</changefreq>`,
    `    <priority>${prio}</priority>`,
    "  </url>",
  ].join("\n");
}

export function buildSitemap(entries: SitemapEntry[]): string {
  const homepage: SitemapEntry = {
    path: "/",
    lastmod: maxLastmod(entries),
    priority: 1.0,
    changefreq: "daily",
  };

  const sorted = [...entries].sort((a, b) => a.path.localeCompare(b.path));
  const all = [homepage, ...sorted];

  const urls = all
    .map((e) => urlBlock(`${SITE_BASE}${e.path}`, e.lastmod, e.changefreq, e.priority))
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    urls,
    "</urlset>",
  ].join("\n");
}
