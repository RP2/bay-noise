/**
 * Bay Noise — Data Pipeline
 *
 * Single script: scrape foopee.com → dedup venues → enrich via Spotify →
 * parse extra fields → write public/shows.json
 *
 * Usage: npx tsx scripts/build-data.ts
 * Requires SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET env vars for enrichment.
 */

import { load } from "cheerio";
import { readFile, writeFile } from "fs/promises";
import type { ShowsData, ShowDay, VenueEvent, Artist } from "../src/lib/types.js";

// ──────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────

const FOOPEE_BASE = "http://www.foopee.com/punk/the-list/by-date.";
const PAGE_COUNT = 31;
const SPOTIFY_DELAY = 100; // ms between searches
const SPOTIFY_MAX_RETRIES = 3;

/** Venue shorthand expansion map (~15 entries). */
const VENUE_SHORTHAND: Record<string, string> = {
  "bottom of the hill": "Bottom of the Hill",
  "the fillmore": "The Fillmore",
  "fillmore": "The Fillmore",
  "great american music hall": "Great American Music Hall",
  "gamm": "Great American Music Hall",
  "gamh": "Great American Music Hall",
  "independent": "The Independent",
  "the independent": "The Independent",
  "slims": "Slim's",
  "warfield": "The Warfield",
  "the warfield": "The Warfield",
  "fox theater": "Fox Theater",
  "the fox theater": "Fox Theater",
  "fox theatre": "Fox Theater",
  "august hall": "August Hall",
  "brick and mortar": "Brick and Mortar",
  "the chapel": "The Chapel",
  "roxy": "Roxy Theatre",
  "sweetwater": "Sweetwater Music Hall",
  "freight and salvage": "Freight & Salvage",
  "amoeba music sf": "Amoeba, S.F.",
  "amoeba music san francisco": "Amoeba, S.F.",
  "amoeba records sf": "Amoeba, S.F.",
  "amoeba records berkeley": "Amoeba Records, Berkeley",
  "thee stork club": "Stork Club",
  "stork club oakland": "Stork Club",
};

/** City abbreviation map (~10 entries). */
const CITY_MAP: Record<string, string> = {
  "sf": "San Francisco",
  "s.f.": "San Francisco",
  "san francisco": "San Francisco",
  "oakland": "Oakland",
  "oak": "Oakland",
  "berkeley": "Berkeley",
  "berk": "Berkeley",
  "san jose": "San Jose",
  "sj": "San Jose",
  "palo alto": "Palo Alto",
  "santa cruz": "Santa Cruz",
  "sc": "Santa Cruz",
  "petaluma": "Petaluma",
  "sausalito": "Sausalito",
  "napa": "Napa",
  "sacramento": "Sacramento",
  "sac": "Sacramento",
  "vallejo": "Vallejo",
  "albany": "Albany",
  "alameda": "Alameda",
  "novato": "Novato",
  "sebastopol": "Sebastopol",
  "concord": "Concord",
  "hayward": "Hayward",
  "richmond": "Richmond",
  "el cerrito": "El Cerrito",
  "emeryville": "Emeryville",
  "san rafael": "San Rafael",
  "santa rosa": "Santa Rosa",
  "half moon bay": "Half Moon Bay",
  "pleasant hill": "Pleasant Hill",
  "pleasanton": "Pleasanton",
  "san mateo": "San Mateo",
  "san leandro": "San Leandro",
  "santa clara": "Santa Clara",
  "menlo park": "Menlo Park",
  "piedmont": "Piedmont",
  "crockett": "Crockett",
  "felton": "Felton",
  "healdsburg": "Healdsburg",
  "sonoma": "Sonoma",
  "fairfield": "Fairfield",
  "martinez": "Martinez",
  "modesto": "Modesto",
  "mill valley": "Mill Valley",
  "union city": "Union City",
};

/** Month name → number map. */
const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04",
  may: "05", jun: "06", jul: "07", aug: "08",
  sep: "09", oct: "10", nov: "11", dec: "12",
};

// ──────────────────────────────────────────────
// Non-artist filtering (from old shared-utils.js)
// ──────────────────────────────────────────────

const NON_ARTIST_EXACT = new Set([
  "membership meeting", "member meeting", "members meeting",
  "venue meeting", "staff meeting", "volunteer meeting", "board meeting",
  "private event", "private party", "birthday party", "birthday bash",
  "birthday celebration", "closed",
  "doors", "soundcheck", "cleanup", "setup", "teardown", "break", "intermission",
  "tbd", "tba", "to be announced", "to be determined",
  "screening", "film", "movie", "documentary", "cinema",
  "workshop", "talk", "lecture", "discussion",
  "fundraiser", "benefit", "memorial", "tribute",
  "open mic", "karaoke", "trivia", "trivia night",
  "comedy", "comedy show", "stand-up", "standup",
  "poetry", "poetry reading", "book reading",
  "art opening", "art show", "gallery opening", "exhibition",
  "book launch", "author reading", "panel discussion", "q&a",
  "meet and greet", "signing", "dj set",
]);

const NON_ARTIST_PATTERNS = [
  /\(comedian\)/i, /^screening\s+of\s+/i, /\s+screening$/i,
  /^film\s+screening/i, /^movie\s+screening/i,
  /^film:\s+/i, /^movie:\s+/i, /^documentary:\s+/i,
  /^benefit\s+for\s+/i, /^memorial\s+for\s+/i,
  /^tribute\s+to\s+/i, /^fundraiser\s+for\s+/i,
  /open\s+mic(\s+night)?$/i, /comedy\s+(show|night)$/i,
  /trivia\s+night$/i, /^dj\s+night$/i, /^karaoke$/i,
  /birthday bash/i, /birthday celebration/i, /birthday party/i,
  /'?s\s+\d+(?:st|nd|rd|th)?\s+birthday/i, // "Carmela's 60th Birthday"
  /\d+(?:st|nd|rd|th)\s+birthday/i, // "60th Birthday"
  /^birthday\s+/, // "Birthday Bash", "Birthday Party" (standalone)
  /^\d{1,2}(:\d{2})?\s*(am|pm|a\.?m\.?|p\.?m\.?)?\s*$/i,
  /^\$\d+(\.\d{2})?(\s*-\s*\$\d+(\.\d{2})?)?$/,
];

function isNonArtist(name: string): boolean {
  const n = name.toLowerCase().trim();
  if (NON_ARTIST_EXACT.has(n)) return true;
  if (NON_ARTIST_PATTERNS.some((p) => p.test(name))) return true;
  return false;
}

// ──────────────────────────────────────────────
// Text helpers
// ──────────────────────────────────────────────

function normalizeText(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

function normalizeForMatching(text: string): string {
  let n = normalizeText(text);
  if (n.startsWith("the ")) n = n.slice(4);
  return n;
}

function cleanArtistName(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*/g, "").trim();
}

/**
 * Algorithmic name matching — determines whether two names refer to the same entity
 * despite typos, abbreviations, or formatting differences.
 *
 * Strategy (in order):
 * 1. Exact match after normalization (fast path)
 * 2. Word containment of SIGNIFICANT words (filters out common venue words)
 * 3. Character-overlap ratio > 0.80 (shared chars / unique chars)
 *
 * No Levenshtein distance, no manual correction dictionary. No naive substring
 * check — that caused false matches on common words like "Shop" or "Club".
 * Handles foopee's common typos ("suicidal tendecies" → "suicidal tendencies")
 * via word/char overlap.
 */

/** Common venue words that shouldn't be used as matching signals. */
const STOP_WORDS = new Set([
  "the", "a", "an", "and", "of", "in", "at", "on", "for", "to", "with",
  "club", "bar", "hall", "house", "room", "lounge", "pub", "inn",
  "cafe", "grill", "shop", "store", "music", "records",
  "theater", "theatre", "center", "centre", "studio", "space",
  "park", "street", "st", "avenue", "ave", "road", "rd", "drive", "dr", "way",
  "sf", "s.f.", "san", "francisco", "oakland", "berkeley", "venue",
  "tavern", "brewery", "brewing", "company", "co", "inc", "llc",
]);

function namesMatch(a: string, b: string): boolean {
  const na = normalizeForMatching(a);
  const nb = normalizeForMatching(b);

  if (!na || !nb) return false;
  if (na === nb) return true; // exact match

  // Space-agnostic match: handle cases like "no fx" ↔ "nofx",
  // "blink 182" ↔ "blink182", "sum41" ↔ "sum 41"
  if (na.replace(/\s/g, "") === nb.replace(/\s/g, "")) return true;

  // Word containment: all SIGNIFICANT words of the shorter name must
  // appear in the longer name. Common venue words are filtered out to
  // prevent false matches (e.g., "Shop" matching every venue with "Shop").
  const sigWords = (s: string) =>
    s.split(/\s+/).filter((w) => w.length > 2 && !STOP_WORDS.has(w));

  const sigA = sigWords(na);
  const sigB = sigWords(nb);

  if (sigA.length > 0 && sigB.length > 0) {
    const [shorterSig, longerSig] = sigA.length <= sigB.length
      ? [sigA, sigB]
      : [sigB, sigA];
    if (shorterSig.every((w) => longerSig.includes(w))) return true;
  }

  // Character-overlap ratio: count shared characters / total unique characters.
  // Only applies when both names are long enough to be meaningful (≥5 chars).
  // Short names like "Bar" (3 chars) would get 100% overlap with anything
  // containing b/a/r — far too many false positives.
  if (na.length < 5 || nb.length < 5) return false;
  const charsA = new Set(na.replace(/\s/g, ""));
  const charsB = new Set(nb.replace(/\s/g, ""));
  const shared = new Set([...charsA].filter((c) => charsB.has(c)));
  const all = new Set([...charsA, ...charsB]);
  const ratio = all.size > 0 ? shared.size / all.size : 0;
  if (ratio > 0.8) return true;

  return false;
}

// ──────────────────────────────────────────────
// Date normalization (year-rollover aware)
// ──────────────────────────────────────────────

interface DateContext {
  lastDate: { year: number; monthNum: number } | null;
}

function normalizeDate(day: string, ctx: DateContext): string {
  const parts = day.toLowerCase().split(" ");
  if (parts.length < 3) throw new Error(`invalid day format: "${day}"`);
  const monthAbbr = parts[1];
  const dayNum = parseInt(parts[2], 10);
  const month = MONTHS[monthAbbr];
  if (!month) throw new Error(`unknown month: "${monthAbbr}"`);
  const monthNum = parseInt(month, 10);

  const now = new Date();
  const currentYear = now.getFullYear();

  let year: number;
  if (!ctx.lastDate) {
    // First date: pick year closest to today
    let bestYear = currentYear;
    let bestDist = Infinity;
    for (const cy of [currentYear - 1, currentYear, currentYear + 1]) {
      const d = Math.abs(new Date(cy, monthNum - 1, dayNum).getTime() - now.getTime());
      if (d < bestDist) { bestDist = d; bestYear = cy; }
    }
    year = bestYear;
  } else {
    year = ctx.lastDate.year;
    if (monthNum < ctx.lastDate.monthNum) year = ctx.lastDate.year + 1;
  }

  ctx.lastDate = { year, monthNum };
  return `${year}-${month}-${String(dayNum).padStart(2, "0")}`;
}

// ──────────────────────────────────────────────
// Extra field parsing
// ──────────────────────────────────────────────

interface ParsedExtra {
  display: string;
  time: string | null;
  price: string | null;
  age: string | null;
}

function parseExtra(raw: string): ParsedExtra {
  let display = raw.trim();
  const parts: string[] = [];
  let time: string | null = null;
  let price: string | null = null;
  let age: string | null = null;

  // Extract age restriction
  const ageMatch = display.match(/\b(a\/a|all\s*ages|21\+|18\+|5\+|16\+|all ages)\b/i);
  if (ageMatch) {
    age = ageMatch[1].toLowerCase();
    display = display.replace(ageMatch[0], "").trim();
  }

  // Extract price
  const priceMatch = display.match(/\$(\d+(?:\.\d{2})?(?:\s*[-\/]\s*\$?\d+(?:\.\d{2})?)?|free)/i);
  if (priceMatch) {
    price = priceMatch[0].trim();
    display = display.replace(priceMatch[0], "").trim();
  }

  // Extract time
  const timeMatch = display.match(/\b(\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.)(?:\s*[-\/]\s*\d{1,2}(?::\d{2})?\s*(?:am|pm|a\.m\.|p\.m\.))?)\b/i);
  if (timeMatch) {
    time = timeMatch[1].trim();
    display = display.replace(timeMatch[0], "").trim();
  }

  // Build display string
  if (age) parts.push(age);
  if (time) parts.push(time);
  if (price) parts.push(price);

  return {
    display: parts.join(" · ") || raw.trim(),
    time,
    price,
    age,
  };
}

// ──────────────────────────────────────────────
// Venue dedup (HD 3)
// ──────────────────────────────────────────────

interface VenueAliasEntry {
  canonical: string;
  aliases: string[];
}

interface KnownVenue {
  name: string;
  city: string | null;
  address: string | null;
  aliases: string[];
}

interface DedupResult {
  canonicalName: string;
  city: string | null;
  address: string | null;
}

/** Clean venue name — strip noise words, age restrictions, city suffix. */
function cleanVenueName(name: string): string {
  let result = name.trim();

  // Strip age restrictions and event descriptors sometimes
  // appended to venue names (e.g., "Bottom of the Hill 21+")
  const noisePatterns = [
    /\s+(18\+|21\+|all\s*ages|sold\s*out|cancelled|canceled|postponed)\s*$/i,
    /\s+presents?\s*$/i,
  ];
  for (const p of noisePatterns) {
    result = result.replace(p, "");
  }

  // Strip trailing city/location suffix
  const citySuffixes = [
    /,\s*(?:sf|s\.f\.|san\s*francisco|oakland|oak|berkeley|berk|san\s*jose|sj|palo\s*alto|santa\s*cruz|sc|petaluma|sausalito|napa|sacramento|sac|vallejo|albany|alameda|novato|sebastopol|concord|hayward|richmond|el\s*cerrito|emeryville|san\s*rafael|santa\s*rosa|half\s*moon\s*bay|pleasant\s*hill|pleasanton|san\s*leandro|san\s*mateo|santa\s*clara|menlo\s*park|piedmont|crockett|felton|healdsburg|sonoma|fairfield|martinez|modesto|mill\s*valley|union\s*city)\s*$/i,
    /,\s*(?:ca|california)\s*$/i,
  ];
  for (const s of citySuffixes) {
    result = result.replace(s, "");
  }

  return result.trim();
}

function deduplicateVenue(
  rawName: string,
  aliases: Map<string, VenueAliasEntry>,
  knownVenues: KnownVenue[],
): DedupResult {
  let name = rawName.trim();
  let address: string | null = null;
  let city: string | null = null;

  // Step a: Expand shorthand
  const nameLower = name.toLowerCase().trim();
  if (VENUE_SHORTHAND[nameLower]) {
    name = VENUE_SHORTHAND[nameLower];
  }

  // Step b: Clean venue name (strip suffixes, noise, age restrictions)
  const stripped = cleanVenueName(name);

  // Step c: Normalize for lookup
  const normalized = normalizeText(stripped);

  // Helper: merge raw name as alias
  const addAlias = (entry: VenueAliasEntry) => {
    const rawLower = normalizeText(rawName);
    if (!entry.aliases.some((a) => normalizeText(a) === rawLower)) {
      entry.aliases.push(rawName);
    }
  };

  // Step d: Check known-venues FIRST (before session aliases).
  // Known venues have canonical names and cities; session aliases may have
  // stale scraped names from pre-known-venues runs.
  // For multi-location venues (e.g. Hopmonk Tavern in Novato & Sebastopol),
  // disambiguate by extracting city from the raw scraped name.
  const scrapedCity = extractCity(rawName);
  const knownMatches: Array<{ kv: KnownVenue; matchType: string }> = [];

  for (const kv of knownVenues) {
    // Check canonical name
    if (namesMatch(stripped, kv.name)) {
      knownMatches.push({ kv, matchType: "canonical" });
      continue;
    }
    // Check known aliases
    for (const alias of kv.aliases ?? []) {
      if (namesMatch(stripped, alias)) {
        knownMatches.push({ kv, matchType: "alias" });
        break;
      }
    }
  }

  if (knownMatches.length === 1) {
    // Unique match — use it
    const { kv } = knownMatches[0];
    addAlias({ canonical: kv.name, aliases: [] });
    if (!aliases.has(normalized)) {
      aliases.set(normalized, { canonical: kv.name, aliases: [rawName] });
    }
    return { canonicalName: kv.name, city: kv.city, address: kv.address };
  }

  if (knownMatches.length > 1) {
    // Multiple matches (e.g. Hopmonk Tavern in Novato & Sebastopol).
    // Disambiguate by city extracted from the raw name.
    if (scrapedCity) {
      const sc = scrapedCity.toLowerCase();
      const byCity = knownMatches.find((m) => m.kv.city?.toLowerCase() === sc);
      if (byCity) {
        addAlias({ canonical: byCity.kv.name, aliases: [] });
        if (!aliases.has(normalized)) {
          aliases.set(normalized, { canonical: byCity.kv.name, aliases: [rawName] });
        }
        return { canonicalName: byCity.kv.name, city: byCity.kv.city, address: byCity.kv.address };
      }
    }
    // No city disambiguation — fall through to first match
    const { kv } = knownMatches[0];
    addAlias({ canonical: kv.name, aliases: [] });
    if (!aliases.has(normalized)) {
      aliases.set(normalized, { canonical: kv.name, aliases: [rawName] });
    }
    return { canonicalName: kv.name, city: kv.city, address: kv.address };
  }

  // Step e: Check session aliases (exact match)
  if (aliases.has(normalized)) {
    const entry = aliases.get(normalized)!;
    addAlias(entry);
    return { canonicalName: entry.canonical, city, address };
  }

  // Step f: Algorithmic fallback — check session aliases
  for (const entry of aliases.values()) {
    if (namesMatch(stripped, entry.canonical)) {
      addAlias(entry);
      if (!aliases.has(normalized)) {
        aliases.set(normalized, entry);
      }
      return { canonicalName: entry.canonical, city, address };
    }
  }

  // Step g: Create new entry
  aliases.set(normalized, { canonical: name, aliases: [rawName] });
  return { canonicalName: name, city, address };
}

// ──────────────────────────────────────────────
// City extraction (HD 4)
// ──────────────────────────────────────────────

function extractCity(venueName: string): string | null {
  const match = venueName.match(/,\s*([^,]+?)\s*$/);
  if (!match) return null;
  const suffix = match[1].toLowerCase().trim();
  return CITY_MAP[suffix] ?? null;
}

// ──────────────────────────────────────────────
// Spotify enrichment (HD 2)
// ──────────────────────────────────────────────

interface ArtistCacheEntry {
  name: string;
  genres: string[];
  spotifyUrl?: string;
}

async function getSpotifyToken(clientId: string, clientSecret: string): Promise<string> {
  const cred = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${cred}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });
  if (!res.ok) throw new Error(`spotify token failed: ${res.status}`);
  const data = await res.json() as { access_token: string };
  return data.access_token;
}

async function spotifySearchArtist(
  name: string,
  token: string,
  retries = 0,
): Promise<{ name: string; genres: string[]; spotifyUrl: string } | null> {
  const q = encodeURIComponent(name);
  const url = `https://api.spotify.com/v1/search?q=${q}&type=artist&limit=1`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (res.status === 429) {
      if (retries < SPOTIFY_MAX_RETRIES) {
        const retryAfter = parseInt(res.headers.get("retry-after") || "2", 10) * 1000;
        console.log(`  rate limited, retrying in ${retryAfter}ms...`);
        await sleep(retryAfter);
        return spotifySearchArtist(name, token, retries + 1);
      }
      console.log(`  rate limited after ${SPOTIFY_MAX_RETRIES} retries, skipping`);
      return null;
    }

    if (!res.ok) {
      console.log(`  spotify search error: ${res.status}`);
      return null;
    }

    const data = await res.json() as {
      artists?: { items: Array<{ name: string; genres: string[]; external_urls: { spotify?: string } }> };
    };
    const items = data.artists?.items ?? [];
    if (items.length === 0) return null;

    const top = items[0];

    // Accept if the names match algorithmically (handles typos naturally —
    // Spotify's search is already fuzzy, so "Mettalica" returns Metallica
    // as the top result, and namesMatch confirms they're close enough).
    if (namesMatch(name, top.name)) {
      return {
        name: top.name,
        genres: top.genres ?? [],
        spotifyUrl: top.external_urls?.spotify ?? `https://open.spotify.com/search/${q}`,
      };
    }

    return null;
  } catch (err) {
    if (retries < SPOTIFY_MAX_RETRIES) {
      await sleep(1000);
      return spotifySearchArtist(name, token, retries + 1);
    }
    console.log(`  search failed for "${name}": ${err}`);
    return null;
  }
}

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function loadJsonFile<T>(path: string, fallback: T): Promise<T> {
  try {
    const raw = await readFile(path, "utf-8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

// ──────────────────────────────────────────────
// Extra cleanup (from old scrape logic)
// ──────────────────────────────────────────────

function cleanExtra(text: string): string {
  return text
    .replace(/--\s*,/g, "--")
    .replace(/\s+,/g, ",")
    .replace(/,+/g, ",")
    .replace(/(?:^,|,$)/g, "")
    .replace(/,\s*,+/g, ",")
    .replace(/\s*\n\s*/g, " ")
    .replace(/\s{2,}/g, " ")
    .replace(/(,\s*)+/g, ", ")
    .replace(/^,|,$/g, "")
    .trim();
}

// ──────────────────────────────────────────────
// Scraping
// ──────────────────────────────────────────────

async function fetchPage(url: string) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return load(await res.text());
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────
// Main
// ──────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("=== Bay Noise Pipeline ===");
  console.log();

  // ── Load cache files ──
  const venueAliases = await loadJsonFile<Record<string, VenueAliasEntry>>(
    "public/venue-aliases.json", {},
  );
  const venueAliasMap = new Map<string, VenueAliasEntry>(Object.entries(venueAliases));

  // ── Load known venues (curated list from old bay-punks) ──
  const knownVenuesRaw = await loadJsonFile<KnownVenue[]>("public/known-venues.json", []);
  const knownVenuesMap: KnownVenue[] = knownVenuesRaw;
  console.log(`✓ Loaded ${knownVenuesMap.length} known venues`);

  const artistCache = await loadJsonFile<Record<string, ArtistCacheEntry>>(
    "public/artist-cache.json", {},
  );
  const artistCacheMap = new Map<string, ArtistCacheEntry>(Object.entries(artistCache));

  // ── Spotify auth ──
  const spotifyClientId = process.env.SPOTIFY_CLIENT_ID;
  const spotifyClientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  let token: string | null = null;

  if (spotifyClientId && spotifyClientSecret) {
    try {
      token = await getSpotifyToken(spotifyClientId, spotifyClientSecret);
      console.log("✓ Spotify authenticated");
    } catch (err) {
      console.log(`⚠ Spotify auth failed: ${err}. Enrichment skipped.`);
    }
  } else {
    console.log("⚠ SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET not set. Enrichment skipped.");
  }

  // ── Scrape foopee pages ──
  console.log("\nScraping foopee.com...");
  const pageUrls = Array.from({ length: PAGE_COUNT }, (_, i) => `${FOOPEE_BASE}${i}.html`);
  const pageResults = await Promise.all(pageUrls.map(fetchPage));
  const pages = pageResults.filter((p): p is ReturnType<typeof load> => p !== null);
  console.log(`  ${pages.length}/${PAGE_COUNT} pages fetched`);

  if (pages.length === 0) {
    console.error("FATAL: No pages fetched. Aborting.");
    process.exit(1);
  }

  // ── Parse pages ──
  interface ScrapedEvent {
    venue: { text: string };
    bands: Array<{ text: string }>;
    extra: string;
  }
  interface ScrapedDay {
    day: string;
    date: string;
    events: ScrapedEvent[];
  }

  const scrapedDays: ScrapedDay[] = [];
  let totalEvents = 0;
  let excluded = 0;
  const dateCtx: DateContext = { lastDate: null };

  for (const $ of pages) {
    $("ul > li").each((_i: number, dayLi: unknown) => {
      const $dayLi = $(dayLi as any);
      const dayText = $dayLi.find("> a > b").first().text().trim();
      if (!dayText) return;

      const eventsUl = $dayLi.children("ul").first();
      const events: ScrapedEvent[] = [];

      eventsUl.children("li").each((_j: number, eventLi: unknown) => {
        const $evt = $(eventLi as any);
        const venueEl = $evt.find('a[href^="by-club"]').first();
        const venueText = venueEl.text().trim();
        if (!venueText) return;

        // Extract artists (filter non-artists)
        const bandEls = $evt.find('a[href*="by-band"]');
        const bands: Array<{ text: string }> = [];
        for (let k = 0; k < bandEls.length; k++) {
          const el = bandEls[k] as any;
          const raw = $(el).text().trim();
          if (isNonArtist(raw)) {
            excluded++;
            continue;
          }
          const cleaned = cleanArtistName(raw);
          if (cleaned) bands.push({ text: cleaned });
        }

        if (bands.length === 0) return;

        // Extract extra
        let extra = $evt
          .clone()
          .find("a")
          .remove()
          .end()
          .text()
          .replace(venueText, "")
          .trim();
        extra = cleanExtra(extra);

        events.push({ venue: { text: venueText }, bands, extra });
        totalEvents++;
      });

      if (events.length > 0) {
        const date = normalizeDate(dayText, dateCtx);
        scrapedDays.push({ day: dayText, date, events });
      }
    });
  }

  // Deduplicate dates (overlapping pages)
  const dateMap = new Map<string, ScrapedDay>();
  for (const day of scrapedDays) {
    if (dateMap.has(day.date)) {
      const existing = dateMap.get(day.date)!;
      for (const evt of day.events) {
        const dup = existing.events.some(
          (e) => e.venue.text === evt.venue.text && e.extra === evt.extra,
        );
        if (!dup) existing.events.push(evt);
      }
    } else {
      dateMap.set(day.date, { ...day, events: [...day.events] });
    }
  }
  const uniqueDays = [...dateMap.values()];
  console.log(`  Events: ${totalEvents}, Non-artist exclusions: ${excluded}`);
  console.log(`  Raw days: ${scrapedDays.length}, Unique days: ${uniqueDays.length}`);

  // ── Process each event ──
  let enrichedCount = 0;
  let cachedCount = 0;
  let skipCount = 0;

  const outputDays: ShowDay[] = [];

  for (const day of uniqueDays) {
    const venues: VenueEvent[] = [];

    for (const evt of day.events) {
      // Venue dedup + known-venue validation
      const dedup = deduplicateVenue(evt.venue.text, venueAliasMap, knownVenuesMap);
      const venueName = dedup.canonicalName;
      // Use canonical city from known venues when available; fall back to extraction
      const city = dedup.city ?? extractCity(evt.venue.text);

      // Parse extra
      const parsed = parseExtra(evt.extra);

      // Artist enrichment
      const artists: Artist[] = [];
      for (const band of evt.bands) {
        const cacheKey = normalizeForMatching(band.text);
        const cached = artistCacheMap.get(cacheKey);

        if (cached) {
          // Use cached data
          const entry: Artist = { name: band.text, genres: cached.genres };
          if (cached.spotifyUrl) entry.spotifyUrl = cached.spotifyUrl;
          artists.push(entry);
          cachedCount++;
        } else if (token) {
          // Search Spotify
          await sleep(SPOTIFY_DELAY);
          const result = await spotifySearchArtist(band.text, token);
          if (result) {
            artists.push({
              name: result.name,
              genres: result.genres,
              spotifyUrl: result.spotifyUrl,
            });
            artistCacheMap.set(cacheKey, {
              name: result.name,
              genres: result.genres,
              spotifyUrl: result.spotifyUrl,
            });
            enrichedCount++;
          } else {
            // No match — cache as "no match" (empty genres, no spotifyUrl)
            artists.push({ name: band.text, genres: [] });
            artistCacheMap.set(cacheKey, { name: band.text, genres: [] });
            skipCount++;
          }
        } else {
          // No Spotify token — skip enrichment
          artists.push({ name: band.text, genres: [] });
          skipCount++;
        }
      }

      venues.push({
        name: venueName,
        city,
        artists,
        extra: parsed.display,
        time: parsed.time,
        price: parsed.price,
        age: parsed.age,
      });
    }

    outputDays.push({
      date: day.date,
      day: day.day,
      venues,
    });
  }

  console.log(`\n  Spotify: ${enrichedCount} enriched, ${cachedCount} cached, ${skipCount} skipped`);

  // ── Build output ──
  const today = new Date().toISOString().slice(0, 10);
  const output: ShowsData = {
    updated: today,
    shows: outputDays,
  };

  // ── Write files ──
  const outputDir = "public";

  await writeFile(`${outputDir}/shows.json`, JSON.stringify(output, null, 2));
  console.log(`\n✓ Wrote ${outputDir}/shows.json (${outputDays.length} days, ${venuesCount(outputDays)} venues)`);

  // Write venue aliases back
  const aliasObj: Record<string, VenueAliasEntry> = {};
  for (const [key, val] of venueAliasMap) {
    aliasObj[key] = val;
  }
  await writeFile(`${outputDir}/venue-aliases.json`, JSON.stringify(aliasObj, null, 2));
  console.log(`✓ Wrote ${outputDir}/venue-aliases.json (${Object.keys(aliasObj).length} entries)`);

  // Write artist cache back
  const cacheObj: Record<string, ArtistCacheEntry> = {};
  for (const [key, val] of artistCacheMap) {
    cacheObj[key] = val;
  }
  await writeFile(`${outputDir}/artist-cache.json`, JSON.stringify(cacheObj, null, 2));
  console.log(`✓ Wrote ${outputDir}/artist-cache.json (${Object.keys(cacheObj).length} entries)`);

  console.log("\n=== Pipeline complete ===");
}

function venuesCount(days: ShowDay[]): number {
  return days.reduce((sum, d) => sum + d.venues.length, 0);
}

main().catch((err) => {
  console.error("Pipeline failed:", err);
  process.exit(1);
});
