import type { ShowDay, ScoredShow, FilterState, UserPrefs } from "./types.js";
import { scoreArtistGenres } from "./genres.js";

/**
 * Flatten ShowDay[] into ScoredShow[] and compute genre-match scores.
 *
 * Each VenueEvent becomes one ScoredShow. Score = number of artists
 * in that venue where at least one genre intersects preferredGenres
 * (per GUIDE.md HD 9 scoring algorithm: matching artist count).
 *
 * Days with no preferredGenres (empty array) all get score 0.
 */
/** Get today's date as YYYY-MM-DD in local timezone. */
function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function flattenAndScoreShows(
  shows: ShowDay[],
  prefs: UserPrefs,
): ScoredShow[] {
  const preferred = prefs.preferredGenres;
  const scored: ScoredShow[] = [];
  const cutoff = todayLocal();

  for (const day of shows) {
    // Skip past dates
    if (day.date < cutoff) continue;
    for (const venue of day.venues) {
      const score = preferred.length > 0
        ? venue.artists.reduce((acc, artist) => {
            // Per-artist: >0 if at least one genre matches
            return acc + Math.min(scoreArtistGenres(artist.genres, preferred), 1);
          }, 0)
        : 0;

      // NOTE(port): Shallow-copy artists array to prevent mutation leaks.
      // If a caller modifies result[0].artists, it does NOT corrupt ShowsData.
      // Artist objects themselves remain shared (no deep copy) — in practice
      // the app never mutates individual artist objects.
      scored.push({
        date: day.date,
        day: day.day,
        venueName: venue.name,
        city: venue.city,
        artists: [...venue.artists],
        extra: venue.extra,
        time: venue.time,
        price: venue.price,
        age: venue.age,
        score,
      });
    }
  }

  return scored;
}

/**
 * Sort ScoredShow[] by score descending, then by date ascending.
 * Higher-scored shows float to top. Same-score shows ordered by date.
 */
export function sortShows(shows: ScoredShow[]): ScoredShow[] {
  return [...shows].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.date.localeCompare(b.date);
  });
}

/**
 * Split ScoredShow[] into above-fold (score > 0) and below-fold (score = 0).
 */
export function splitByScore(
  shows: ScoredShow[],
): { above: ScoredShow[]; below: ScoredShow[] } {
  const above: ScoredShow[] = [];
  const below: ScoredShow[] = [];
  for (const show of shows) {
    if (show.score > 0) {
      above.push(show);
    } else {
      below.push(show);
    }
  }
  return { above, below };
}

/**
 * Check if any shows have score = 0 (i.e., there's a fold to toggle).
 */
export function hasShowsBelowFold(shows: ScoredShow[]): boolean {
  return shows.some((s) => s.score === 0);
}

/**
 * Case-insensitive free-text search across artist names, venue name,
 * city, and extra field. Returns shows where any of these fields contain
 * the query as a substring.
 *
 * Returns a new array even for empty query (no reference leak).
 */
const SEARCH_STOP_WORDS = new Set([
  "the", "a", "an", "of", "in", "on", "at", "to", "for", "with", "and", "or",
]);

export function filterByQuery(
  shows: ScoredShow[],
  query: string,
): ScoredShow[] {
  const raw = query.toLowerCase().trim();
  if (!raw) return [...shows];

  // Split into words, exclude stop words. Remaining words are OR'd.
  // "punk indie" matches shows with punk OR indie in any field.
  const words = raw.split(/\s+/)
    .filter((w) => w.length > 2 && !SEARCH_STOP_WORDS.has(w));
  if (words.length === 0) return [...shows];

  return shows.filter((show) => {
    for (const word of words) {
      // Search venue name
      if (show.venueName.toLowerCase().includes(word)) return true;
      // Search city (guard against null)
      if (show.city && show.city.toLowerCase().includes(word)) return true;
      // Search extra
      if (show.extra.toLowerCase().includes(word)) return true;
      // Search artist names + genres
      for (const artist of show.artists) {
        if (artist.name.toLowerCase().includes(word)) return true;
        for (const genre of artist.genres) {
          if (genre.toLowerCase().includes(word)) return true;
        }
      }
    }
    return false;
  });
}

/**
 * Apply all filters to ScoredShow[].
 * Filters combine with AND logic (GUIDE.md HD 9 decision).
 * Venue filter, artist filter, and query search must ALL match.
 *
 * When showAll is true, the score-based fold is bypassed
 * (all shows returned, still sorted by score then date).
 * When showAll is false, only above-fold shows (score > 0) are returned.
 */
export function applyFilters(
  shows: ScoredShow[],
  filter: FilterState,
): ScoredShow[] {
  let result = shows;

  // Venue filter
  if (filter.venue) {
    const v = filter.venue.toLowerCase();
    result = result.filter((s) => s.venueName.toLowerCase().includes(v));
  }

  // Artist filter
  if (filter.artist) {
    const a = filter.artist.toLowerCase();
    result = result.filter((s) =>
      s.artists.some((artist) => artist.name.toLowerCase().includes(a)),
    );
  }

  // Free-text query search
  if (filter.query) {
    result = filterByQuery(result, filter.query);
  }

  // Score fold: hide score=0 shows unless showAll is true.
  // When an explicit venue or artist filter is active, bypass the fold —
  // the user is actively browsing a specific venue/artist and wants to
  // see all their shows, not just personalized picks.
  const hasExplicitFilter = filter.venue !== null || filter.artist !== null;
  if (!filter.showAll && !hasExplicitFilter) {
    result = result.filter((s) => s.score > 0);
  }

  return result;
}

/**
 * Full pipeline: flatten, score, sort, and optionally apply filters.
 * Convenience function for the app shell.
 *
 * When prefs.onboarded is false but prefs are still provided,
 * flattenAndScoreShows handles empty preferredGenres (all score 0).
 */
export function processShows(
  shows: ShowDay[],
  prefs: UserPrefs,
  filter: FilterState,
): ScoredShow[] {
  const scored = flattenAndScoreShows(shows, prefs);
  const sorted = sortShows(scored);
  return applyFilters(sorted, filter);
}
