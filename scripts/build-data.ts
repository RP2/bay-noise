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
import { readFile, writeFile, rename, readdir, unlink } from "fs/promises";
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
  knownVenueIndex: number | null;
  source: "known" | "unmatched";
  ambiguousMessage?: string;
}

interface UnmatchedVenue {
  scrapedName: string;
  venueName: string;
  city: string | null;
  address: string | null;
  extra: string;
  seen: string;
  count: number;
}

type MatchConfidence = "high" | "medium" | "low" | "none";

interface MatchCandidate {
  name: string;
  city?: string | null;
  address?: string | null;
  aliases?: string[];
}

function normalizeVenueName(name: string): string {
  return normalizeForMatching(cleanVenueName(name));
}

function getSignificantWords(text: string): string[] {
  return text.split(/\s+/).filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function characterOverlap(a: string, b: string): number {
  const charsA = new Set(a.replace(/\s/g, ""));
  const charsB = new Set(b.replace(/\s/g, ""));
  const shared = new Set([...charsA].filter((c) => charsB.has(c)));
  const all = new Set([...charsA, ...charsB]);
  return all.size > 0 ? shared.size / all.size : 0;
}

function computeMatchConfidence(a: string, b: string): MatchConfidence {
  if (a === b) return "high";

  const sigA = getSignificantWords(a);
  const sigB = getSignificantWords(b);
  const wordContainment = sigA.length > 0 && sigB.length > 0 &&
    (sigA.length <= sigB.length
      ? sigA.every((w) => sigB.includes(w))
      : sigB.every((w) => sigA.includes(w)));

  const overlap = characterOverlap(a, b);
  const lengthRatio = Math.min(a.length, b.length) / Math.max(a.length, b.length);

  if (wordContainment && overlap > 0.75) return "medium";
  if (overlap > 0.5 && !wordContainment) return "low";
  if (wordContainment && lengthRatio < 0.5) return "low";

  return "none";
}

function matchVenue(
  name: string,
  candidates: MatchCandidate[],
): {
  confidence: MatchConfidence;
  candidate: MatchCandidate | null;
  index: number | null;
} {
  const normalizedName = normalizeVenueName(name);
  if (!normalizedName) return { confidence: "none", candidate: null, index: null };

  let bestLow: { candidate: MatchCandidate; index: number; score: number } | null = null;

  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i];
    for (const candidateName of [candidate.name, ...(candidate.aliases ?? [])]) {
      const normalizedCandidate = normalizeVenueName(candidateName);
      if (!normalizedCandidate) continue;

      const confidence = computeMatchConfidence(normalizedName, normalizedCandidate);
      if (confidence === "none") continue;
      if (confidence === "high") return { confidence: "high", candidate, index: i };
      if (confidence === "medium") return { confidence: "medium", candidate, index: i };

      const score = characterOverlap(normalizedName, normalizedCandidate);
      if (!bestLow || score > bestLow.score) {
        bestLow = { candidate, index: i, score };
      }
    }
  }

  return bestLow
    ? { confidence: "low", candidate: bestLow.candidate, index: bestLow.index }
    : { confidence: "none", candidate: null, index: null };
}

function findAllVenueMatches(
  name: string,
  candidates: MatchCandidate[],
): Array<{ candidate: MatchCandidate; index: number; confidence: MatchConfidence }> {
  const matches: Array<{ candidate: MatchCandidate; index: number; confidence: MatchConfidence }> = [];
  for (let i = 0; i < candidates.length; i++) {
    const { confidence } = matchVenue(name, [candidates[i]]);
    if (confidence !== "none") matches.push({ candidate: candidates[i], index: i, confidence });
  }
  return matches;
}

/** Clean venue name — strip noise words, age restrictions, city suffix. */
function cleanVenueName(name: string): string {
  let result = name.trim();

  // Strip age restrictions and event descriptors sometimes
  // appended to venue names (e.g., "Bottom of the Hill 21+")
  const noisePatterns = [
    /\s+(?:18|21)(?:\+)?\s*$/i,
    /\s+(all\s*ages|sold\s*out|cancelled|canceled|postponed)\s*$/i,
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

function addAliasToKnownVenue(venue: KnownVenue, rawName: string): void {
  // Don't add the canonical name as an alias of itself
  if (normalizeText(rawName) === normalizeText(venue.name)) return;
  const rawNormalized = normalizeText(rawName);
  if (!venue.aliases.some((a) => normalizeText(a) === rawNormalized)) {
    venue.aliases.push(rawName);
  }
}

function deduplicateVenue(
  rawName: string,
  knownVenues: KnownVenue[],
  unmatchedVenues: UnmatchedVenue[],
  today: string,
): DedupResult {
  let name = rawName.trim();

  // Expand shorthand
  const nameLower = name.toLowerCase().trim();
  if (VENUE_SHORTHAND[nameLower]) {
    name = VENUE_SHORTHAND[nameLower];
  }

  // Clean venue name (strip suffixes, noise, age restrictions)
  const stripped = cleanVenueName(name);
  const scrapedCity = extractCity(rawName);

  // Find all high/medium known-venue matches for city/address disambiguation
  const matches = findAllVenueMatches(stripped, knownVenues).filter(
    (m) => m.confidence === "high" || m.confidence === "medium",
  );

  if (matches.length === 1) {
    // Unique match — use it directly
    const match = matches[0];
    const kv = match.candidate as KnownVenue;
    addAliasToKnownVenue(knownVenues[match.index], rawName);
    return {
      canonicalName: kv.name, city: kv.city, address: kv.address,
      knownVenueIndex: match.index, source: "known",
    };
  }

  if (matches.length > 1) {
    // Multiple matches — disambiguate by city, then by address
    let match = matches[0];
    if (scrapedCity) {
      const byCity = matches.find(
        (m) => (m.candidate as KnownVenue).city?.toLowerCase() === scrapedCity.toLowerCase(),
      );
      if (byCity) match = byCity;
    }
    // If still ambiguous and no city to disambiguate, send to unmatched
    const hasAmbiguousSameCity = matches.length > 1 && !scrapedCity &&
      new Set(matches.map((m) => (m.candidate as KnownVenue).city)).size > 1;
    if (hasAmbiguousSameCity) {
      // No city to disambiguate — safe to queue
      const kv = match.candidate as KnownVenue;
      // Still use the best match but log it after the progress loop
      addAliasToKnownVenue(knownVenues[match.index], rawName);
      return {
        canonicalName: kv.name, city: kv.city, address: kv.address,
        knownVenueIndex: match.index, source: "known",
        ambiguousMessage: `  Ambiguous venue (${matches.length} matches) with no city — queueing: "${rawName}"`,
      };
    }

    const kv = match.candidate as KnownVenue;
    addAliasToKnownVenue(knownVenues[match.index], rawName);
    return {
      canonicalName: kv.name, city: kv.city, address: kv.address,
      knownVenueIndex: match.index, source: "known",
    };
  }

  // Low/no confidence — check the unmatched queue.
  // Include city for better matching on re-scrapes.
  const unmatchedCandidates = unmatchedVenues.map((u) => ({
    name: u.venueName, city: u.city, aliases: u.scrapedName ? [u.scrapedName] : [],
  }));
  const unmatchedMatch = matchVenue(stripped, unmatchedCandidates);
  if (unmatchedMatch.confidence !== "none") {
    const existing = unmatchedVenues[unmatchedMatch.index!];
    existing.count++;
    existing.seen = today;
    return {
      canonicalName: existing.venueName,
      city: existing.city,
      address: null,
      knownVenueIndex: null,
      source: "unmatched",
    };
  }

  // Extract address from scraped name for the unmatched queue
  const extractedAddr = extractAddress(rawName);

  // Add new entry to unmatched queue
  const newUnmatched: UnmatchedVenue = {
    scrapedName: rawName,
    venueName: stripped,
    city: scrapedCity,
    address: extractedAddr,
    extra: "",
    seen: today,
    count: 1,
  };
  unmatchedVenues.push(newUnmatched);
  return {
    canonicalName: newUnmatched.venueName,
    city: newUnmatched.city,
    address: null,
    knownVenueIndex: null,
    source: "unmatched",
  };
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

/** Extract a street address from a venue name string, if present. */
function extractAddress(venueName: string): string | null {
  const addrMatch = venueName.match(/,\s*(\d+\s+[A-Za-z0-9\s.]+?)(?:,\s*[A-Za-z\s.]+)?\s*$/);
  if (!addrMatch) return null;
  const addr = addrMatch[1].trim();
  // Skip if the matched segment is obviously a city, not a street address
  if (CITY_MAP[addr.toLowerCase()]) return null;
  return addr;
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

async function atomicWrite(path: string, data: string): Promise<void> {
  const tmp = path + ".tmp";
  await writeFile(tmp, data);
  await rename(tmp, path);
}

function progressLine(message: string): void {
  const width = Math.min(process.stdout.columns ?? 200, 200);
  process.stdout.write(`\r${message.padEnd(width)}`);
}

function logArtistProgress(current: number, total: number, message: string): void {
  if (current === 1 || total <= 50 || current % 50 === 0) {
    progressLine(`  Artist ${current}/${total}: ${message}`);
  }
}

function logVenueProgress(current: number, total: number, message: string): void {
  if (current === 1 || total <= 20 || current % 20 === 0) {
    progressLine(`  Venue ${current}/${total}: ${message}`);
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
  let interrupted = false;
  process.on("SIGINT", () => {
    interrupted = true;
    process.stdout.write("\nInterrupted — flushing cache...\n");
  });

  const outputDir = "public";

  // Clean up any leftover atomic-write tmp files
  try {
    const entries = await readdir(outputDir);
    for (const entry of entries) {
      if (entry.endsWith(".tmp")) {
        await unlink(`${outputDir}/${entry}`);
      }
    }
  } catch {
    // output dir may not exist yet
  }

  // ── Load .env file if present ──
  try {
    const envText = await readFile(".env", "utf-8");
    for (const rawLine of envText.split("\n")) {
      let line = rawLine.trim();
      if (!line || line.startsWith("#")) continue;
      if (line.startsWith("export ")) line = line.slice("export ".length).trim();
      const eqIdx = line.indexOf("=");
      if (eqIdx === -1) continue;
      const key = line.slice(0, eqIdx).trim();
      if (!key) continue;
      let value = line.slice(eqIdx + 1).trim();
      if (value.length >= 2) {
        const first = value[0];
        const last = value[value.length - 1];
        if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
          value = value.slice(1, -1);
        }
      }
      if (value.includes("#")) {
        const commentIdx = value.search(/\s#/);
        if (commentIdx !== -1) value = value.slice(0, commentIdx).trimEnd();
      }
      if (!(key in process.env)) process.env[key] = value;
    }
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") {
      console.warn(`Warning: failed to read .env: ${err}`);
    }
  }

  console.log("=== Bay Noise Pipeline ===");
  console.log();

  // ── Load known venues (single source of truth) ──
  const knownVenues = await loadJsonFile<KnownVenue[]>("public/known-venues.json", []);
  console.log(`✓ Loaded ${knownVenues.length} known venues`);

  // ── Load unmatched-venues review queue ──
  const unmatchedVenues = await loadJsonFile<UnmatchedVenue[]>("public/unmatched-venues.json", []);
  console.log(`✓ Loaded ${unmatchedVenues.length} unmatched venues`);

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
  const totalVenues = uniqueDays.reduce((sum, d) => sum + d.events.length, 0);
  const totalArtists = uniqueDays.reduce(
    (sum, d) => sum + d.events.reduce((es, e) => es + e.bands.length, 0),
    0,
  );
  console.log("\nProcessing events...");

  const today = new Date().toISOString().slice(0, 10);
  let enrichedCount = 0;
  let cachedCount = 0;
  let skipCount = 0;
  let venueCounter = 0;
  let artistCounter = 0;

  const outputDays: ShowDay[] = [];
  const ambiguousMessages: string[] = [];

  for (const day of uniqueDays) {
    if (interrupted) break;
    const venues: VenueEvent[] = [];

    for (const evt of day.events) {
      if (interrupted) break;
      venueCounter++;

      // Venue dedup + known-venue validation
      const dedup = deduplicateVenue(evt.venue.text, knownVenues, unmatchedVenues, today);
      if (dedup.ambiguousMessage) ambiguousMessages.push(dedup.ambiguousMessage);
      const venueName = dedup.canonicalName;
      // Use canonical city from known venues when available; fall back to extraction
      const city = dedup.city ?? extractCity(evt.venue.text);

      const venueStatus = dedup.knownVenueIndex !== null
        ? "matched known venue"
        : dedup.source === "unmatched"
        ? "unmatched venue"
        : "new venue";
      logVenueProgress(
        venueCounter,
        totalVenues,
        `"${venueName}" (${venueStatus})`,
      );

      // Parse extra
      const parsed = parseExtra(evt.extra);

      // Artist enrichment
      const artists: Artist[] = [];
      for (const band of evt.bands) {
        if (interrupted) break;
        artistCounter++;
        const cacheKey = normalizeForMatching(band.text);
        const cached = artistCacheMap.get(cacheKey);

        if (cached) {
          // Use cached data
          const entry: Artist = { name: band.text, genres: cached.genres };
          if (cached.spotifyUrl) entry.spotifyUrl = cached.spotifyUrl;
          artists.push(entry);
          cachedCount++;
          logArtistProgress(
            artistCounter,
            totalArtists,
            `✓ "${band.text}" → ${cached.genres.join(",") || "no genres"} (cached)`,
          );
        } else if (token) {
          // Search Spotify
          logArtistProgress(artistCounter, totalArtists, `Searching "${band.text}" on Spotify...`);
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
            logArtistProgress(
              artistCounter,
              totalArtists,
              `✓ "${result.name}" → ${result.genres.join(",") || "no genres"}`,
            );
          } else {
            // No match — cache as "no match" (empty genres, no spotifyUrl)
            artists.push({ name: band.text, genres: [] });
            artistCacheMap.set(cacheKey, { name: band.text, genres: [] });
            skipCount++;
            logArtistProgress(artistCounter, totalArtists, `✗ "${band.text}" no match`);
          }
        } else {
          // No Spotify token — skip enrichment
          artists.push({ name: band.text, genres: [] });
          skipCount++;
          logArtistProgress(artistCounter, totalArtists, `✗ "${band.text}" no Spotify token`);
        }
      }

      if (interrupted) break;

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

    if (!interrupted) {
      outputDays.push({
        date: day.date,
        day: day.day,
        venues,
      });
    }
  }

  process.stdout.write("\n");
  for (const msg of ambiguousMessages) {
    console.log(msg);
  }
  console.log(`\n  Spotify: ${enrichedCount} enriched, ${cachedCount} cached, ${skipCount} skipped`);

  // ── Build output ──
  const output: ShowsData = {
    updated: today,
    shows: outputDays,
  };

  // ── Write files ──

  await atomicWrite(`${outputDir}/shows.json`, JSON.stringify(output, null, 2));
  console.log(`\n✓ Wrote ${outputDir}/shows.json (${outputDays.length} days, ${venuesCount(outputDays)} venues)`);

  // Write known venues back (single source of truth)
  await atomicWrite(`${outputDir}/known-venues.json`, JSON.stringify(knownVenues, null, 2));
  console.log(`✓ Wrote ${outputDir}/known-venues.json (${knownVenues.length} entries)`);

  // Write unmatched-venues review queue
  await atomicWrite(`${outputDir}/unmatched-venues.json`, JSON.stringify(unmatchedVenues, null, 2));
  console.log(`✓ Wrote ${outputDir}/unmatched-venues.json (${unmatchedVenues.length} entries)`);
  if (unmatchedVenues.length > 0) {
    console.log(`${unmatchedVenues.length} venues unmatched — check unmatched-venues.json`);
  }

  // Write artist cache back
  const cacheObj: Record<string, ArtistCacheEntry> = {};
  for (const [key, val] of artistCacheMap) {
    cacheObj[key] = val;
  }
  await atomicWrite(`${outputDir}/artist-cache.json`, JSON.stringify(cacheObj, null, 2));
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
