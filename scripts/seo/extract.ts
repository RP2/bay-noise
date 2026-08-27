import type { ShowsData, ShowDay, VenueEvent, Artist } from "../../src/lib/types.js";
import { slugify } from "../../src/lib/slug.js";

/** One show as it appears inside a venue/artist/city page list. */
export interface EntityShow {
  date: string;
  day: string;
  extra: string;
  time: string | null;
  price: string | null;
  age: string | null;
  artists: Artist[];
  venueName: string; // only on artist/city pages
  city: string | null; // only on artist pages
  address: string | null;
}

export interface VenueEntity {
  type: "venue";
  name: string; // canonical name from known-venues
  slug: string;
  city: string | null;
  address: string | null;
  shows: EntityShow[];
  lastmod: string; // latest show date (for sitemap)
}

export interface ArtistEntity {
  type: "artist";
  name: string; // canonical name from artist-cache or alphabetical
  slug: string;
  genres: string[];
  spotifyUrl: string | undefined;
  shows: EntityShow[];
  lastmod: string;
}

export interface CityEntity {
  type: "city";
  name: string;
  slug: string;
  shows: EntityShow[];
  lastmod: string;
}

export type SeoEntity = VenueEntity | ArtistEntity | CityEntity;

export interface KnownVenue {
  name: string;
  city: string | null;
  address: string | null;
  aliases: string[];
}

export interface ArtistCacheEntry {
  name: string;
  genres?: string[];
  spotifyUrl?: string;
}

const SHOWS_PER_ENTITY = 50;

/**
 * Normalize a name for cache key lookup. Must match build-data.ts's
 * `normalizeText` so that keys in artist-cache.json resolve correctly.
 */
function normalizeForMatching(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim();
}

/** Get today's date as YYYY-MM-DD in America/Los_Angeles timezone. */
export function todayLocal(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
  });
  return formatter.format(new Date());
}

/**
 * Extract all SEO entities from shows data.
 *
 * @param data - the full shows.json data
 * @param knownVenues - array from known-venues.json (for canonical venue names)
 * @param artistCache - object from artist-cache.json (for canonical artist names)
 * @returns venues, artists, and cities — each sorted alphabetically by slug
 *
 * Pure: no I/O, no mutation of inputs.
 */
export function extractEntities(
  data: ShowsData,
  knownVenues: KnownVenue[],
  artistCache: Record<string, ArtistCacheEntry>,
): { venues: VenueEntity[]; artists: ArtistEntity[]; cities: CityEntity[] } {
  const cutoff = todayLocal();
  const upcomingDays = data.shows.filter((d) => d.date >= cutoff);

  // NOTE(port): Alias lookup is case-insensitive direct match only — the scraper
  // emits known aliases after `build-data.ts` has already normalized venue names.
  // We do NOT do fuzzy matching here; unmatched venues fall through to the raw
  // scraped name (handled by `resolveVenue`).
  const aliasToVenue = new Map<string, KnownVenue>();
  for (const venue of knownVenues) {
    // Add canonical name itself (build-data.ts emits these into shows.json)
    aliasToVenue.set(venue.name.toLowerCase(), venue);
    // Then add aliases
    for (const alias of venue.aliases) {
      aliasToVenue.set(alias.toLowerCase(), venue);
    }
  }

  const resolvedVenues = buildVenueEntities(upcomingDays, aliasToVenue);
  const resolvedArtists = buildArtistEntities(
    upcomingDays,
    aliasToVenue,
    artistCache,
  );
  const resolvedCities = buildCityEntities(upcomingDays, aliasToVenue);

  return {
    venues: resolvedVenues.sort((a, b) => a.slug.localeCompare(b.slug)),
    artists: resolvedArtists.sort((a, b) => a.slug.localeCompare(b.slug)),
    cities: resolvedCities.sort((a, b) => a.slug.localeCompare(b.slug)),
  };
}

function resolveVenue(
  scrapedName: string,
  aliasToVenue: Map<string, KnownVenue>,
): KnownVenue {
  const matched = aliasToVenue.get(scrapedName.toLowerCase());
  if (matched) return matched;
  return { name: scrapedName, city: null, address: null, aliases: [] };
}

function buildVenueEntities(
  days: ShowDay[],
  aliasToVenue: Map<string, KnownVenue>,
): VenueEntity[] {
  const byName = new Map<string, { venue: KnownVenue; shows: EntityShow[] }>();

  for (const day of days) {
    for (const event of day.venues) {
      const venue = resolveVenue(event.name, aliasToVenue);
      let entry = byName.get(venue.name);
      if (!entry) {
        entry = { venue, shows: [] };
        byName.set(venue.name, entry);
      }
      entry.shows.push(makeShow(day, event, venue));
    }
  }

  const out: VenueEntity[] = [];
  for (const { venue, shows } of byName.values()) {
    if (shows.length === 0) continue;
    const sorted = sortAndCap(shows);
    out.push({
      type: "venue",
      name: venue.name,
      slug: slugify(venue.name),
      city: venue.city,
      address: venue.address,
      shows: sorted,
      lastmod: sorted[sorted.length - 1].date,
    });
  }
  return out;
}

function buildArtistEntities(
  days: ShowDay[],
  aliasToVenue: Map<string, KnownVenue>,
  artistCache: Record<string, ArtistCacheEntry>,
): ArtistEntity[] {
  type Group = {
    variants: Set<string>;
    genres: Set<string>;
    spotifyUrl: string | undefined;
    shows: EntityShow[];
  };
  const groups = new Map<string, Group>();

  for (const day of days) {
    for (const event of day.venues) {
      const venue = resolveVenue(event.name, aliasToVenue);

      // NOTE(port): Dedupe within a single bill. If the same artist name appears
      // twice on one show (rare), we count it as one show entry for that artist.
      const seen = new Set<string>();
      for (const artist of event.artists) {
        const key = artist.name.toLowerCase();
        if (seen.has(key)) continue;
        seen.add(key);

        let group = groups.get(key);
        if (!group) {
          group = {
            variants: new Set([artist.name]),
            genres: new Set(artist.genres),
            spotifyUrl: artist.spotifyUrl,
            shows: [],
          };
          groups.set(key, group);
        } else {
          group.variants.add(artist.name);
          for (const g of artist.genres) group.genres.add(g);
          if (!group.spotifyUrl && artist.spotifyUrl) group.spotifyUrl = artist.spotifyUrl;
        }
        group.shows.push(makeShow(day, event, venue));
      }
    }
  }

  const out: ArtistEntity[] = [];
  for (const [key, group] of groups) {
    if (group.shows.length === 0) continue;

    // NOTE(port): Cache hit → use Spotify-canonical name. Otherwise pick the
    // alphabetical-first variant so the casing is deterministic across runs.
    // Cache key uses normalizeForMatching() so punctuation-stripped keys (e.g.
    // "j t" for "J.T.") hit the same entry that build-data.ts wrote.
    const cacheEntry = artistCache[normalizeForMatching(key)];
    const canonicalName = cacheEntry?.name
      ?? [...group.variants].sort((a, b) => a.localeCompare(b))[0]
      ?? key;

    // NOTE(port): Cache's spotifyUrl wins when present. Otherwise keep the first
    // spotifyUrl we found in any show. If neither, undefined.
    const spotifyUrl = cacheEntry?.spotifyUrl ?? group.spotifyUrl;

    const sorted = sortAndCap(group.shows);
    out.push({
      type: "artist",
      name: canonicalName,
      slug: slugify(canonicalName),
      genres: [...group.genres],
      spotifyUrl,
      shows: sorted,
      lastmod: sorted[sorted.length - 1].date,
    });
  }
  return out;
}

function buildCityEntities(
  days: ShowDay[],
  aliasToVenue: Map<string, KnownVenue>,
): CityEntity[] {
  const byCity = new Map<string, EntityShow[]>();

  for (const day of days) {
    for (const event of day.venues) {
      // NOTE(port): Skip null-city events for city pages — there is no canonical
      // city to key the page under. The venue still gets its own page.
      if (!event.city) continue;
      const venue = resolveVenue(event.name, aliasToVenue);
      const list = byCity.get(event.city) ?? [];
      list.push(makeShow(day, event, venue));
      byCity.set(event.city, list);
    }
  }

  const out: CityEntity[] = [];
  for (const [name, shows] of byCity) {
    if (shows.length === 0) continue;
    const sorted = sortAndCap(shows);
    out.push({
      type: "city",
      name,
      slug: slugify(name),
      shows: sorted,
      lastmod: sorted[sorted.length - 1].date,
    });
  }
  return out;
}

function makeShow(
  day: ShowDay,
  event: VenueEvent,
  venue: KnownVenue,
): EntityShow {
  return {
    date: day.date,
    day: day.day,
    extra: event.extra,
    time: event.time,
    price: event.price,
    age: event.age,
    artists: event.artists,
    venueName: venue.name,
    city: event.city,
    address: event.address,
  };
}

function sortAndCap(shows: EntityShow[]): EntityShow[] {
  // NOTE(port): lastmod uses the LATEST show date on the page (after capping),
  // not today's date. This gives crawlers a meaningful freshness signal.
  return [...shows]
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, SHOWS_PER_ENTITY);
}
