/**
 * Genre taxonomy: one Spotify genre → exactly one broad category.
 * No overlaps. Edge cases documented with comments.
 *
 * The keys are the broad category names shown in the greeter.
 * The values are Spotify genre strings that map to that category.
 * Matching is case-insensitive.
 */

export const GENRE_MAP: Record<string, string[]> = {
  punk: ["punk", "pop punk", "skate punk", "anarcho punk", "crust punk", "celtic punk", "folk punk", "ska punk", "cowpunk", "horror punk"],
  indie: ["indie", "indie rock", "indie pop", "indie folk", "indie punk", "indie sleaze", "twee pop", "chillwave"],
  metal: ["metal", "death metal", "black metal", "doom", "sludge", "thrash", "heavy metal", "nu metal", "metalcore", "deathcore", "metalcore punk", "djent", "groove metal", "progressive metal"],
  hiphop: ["hip hop", "rap", "trap", "underground hip hop", "boom bap", "drill", "cloud rap", "pluggnb", "rage"],
  electronic: ["electronic", "techno", "house", "drum and bass", "ambient", "idm", "edm", "hyperpop", "witch house", "footwork", "breakcore", "dubstep", "future bass", "synthwave", "vaporwave", "chiptune"],
  folk: ["folk", "singer-songwriter", "americana", "bluegrass", "country", "folk rock"],
  jazz: ["jazz", "free jazz", "jazz fusion", "bebop", "smooth jazz"],
  hardcore: ["hardcore", "hardcore punk", "powerviolence", "beatdown", "metallic hardcore", "youth crew", "melodic hardcore", "easycore", "beatdown hardcore", "sasscore"],
  shoegaze: ["shoegaze", "dream pop", "noise pop", "ethereal", "shoegaze punk", "blackgaze", "nu gaze"],
  noise: ["noise", "noise rock", "industrial", "industrial rock", "power electronics", "harsh noise", "death industrial"],
  experimental: ["experimental", "avant-garde", "drone", "minimal", "free improvisation", "deconstructed club", "glitch", "plunderphonics"],
  soul: ["soul", "r&b", "funk", "neo soul", "funk rock"],
  hipster: ["art rock", "post-rock", "math rock", "chamber pop", "post-punk"],
};

/** Fallback category for unclassified genres. */
export const OTHER_CATEGORY = "other";

/**
 * A reverse lookup: Spotify genre (lowercase) → broad category.
 * Built once at module load for O(1) lookups.
 * Warns on duplicate genres to catch data bugs.
 */
const genreToCategory = new Map<string, string>();
for (const [category, genres] of Object.entries(GENRE_MAP)) {
  for (const genre of genres) {
    const key = genre.toLowerCase();
    const existing = genreToCategory.get(key);
    if (existing) {
      console.warn(`[genres] genre "${genre}" appears in categories "${existing}" and "${category}" — using "${existing}"`);
    } else {
      genreToCategory.set(key, category);
    }
  }
}

/**
 * Classify a Spotify genre string into its broad category.
 *
 * @param genre - A Spotify genre string (e.g., "indie rock", "death metal")
 * @returns The broad category name (e.g., "indie", "metal"), or "other" if unclassified.
 *
 * Matching is case-insensitive. Unknown/null/empty genres return "other".
 *
 * ```ts
 * classifyGenre("indie rock") // "indie"
 * classifyGenre("unknown genre") // "other"
 * ```
 */
export function classifyGenre(genre: string): string {
  if (typeof genre !== "string" || genre.length === 0) {
    return OTHER_CATEGORY;
  }
  return genreToCategory.get(genre.toLowerCase()) ?? OTHER_CATEGORY;
}

/**
 * Get the list of broad category names (keys of GENRE_MAP).
 * Used by the greeter component to render the genre selection pills.
 */
export function getBroadCategories(): string[] {
  return Object.keys(GENRE_MAP);
}

/**
 * Get the list of Spotify genres that map to a given broad category.
 * Returns a defensive copy — mutating the result does not affect the taxonomy.
 *
 * @param category - A broad category name (e.g., "punk", "indie")
 * @returns The array of Spotify genre strings, or empty array if category not found.
 */
export function getGenresForCategory(category: string): string[] {
  return GENRE_MAP[category] ? [...GENRE_MAP[category]] : [];
}

/**
 * Score an artist's genres against a user's preferred categories.
 * Returns the count of entries in `artistGenres` whose broad category
 * is in `preferredCategories` (an entry appearing twice is counted twice).
 *
 * NOTE(port): HD 9 scoring uses this per-artist as a boolean — check `> 0`.
 * The show-level `scoreShow` must use `Math.min(scoreArtistGenres(...), 1)`
 * per artist to count artists (not genre tags). This function returns raw
 * tag count so callers can choose their aggregation.
 *
 * @param artistGenres - The artist's Spotify genre strings
 * @param preferredCategories - The user's preferred broad category names
 * @returns Match count (0 = no match)
 *
 * ```ts
 * scoreArtistGenres(["punk", "indie"], ["punk"]) // 1
 * scoreArtistGenres(["jazz"], ["punk"]) // 0
 * ```
 */
export function scoreArtistGenres(
  artistGenres: string[],
  preferredCategories: string[],
): number {
  if (!Array.isArray(artistGenres) || !Array.isArray(preferredCategories)) {
    return 0;
  }
  // Normalize preferred categories to lowercase for case-insensitive matching.
  // Without this, stale/uppercase prefs would silently return 0 for all artists.
  const preferredSet = new Set(preferredCategories.map((c) => c.toLowerCase()));
  return artistGenres.filter((g) => preferredSet.has(classifyGenre(g))).length;
}
