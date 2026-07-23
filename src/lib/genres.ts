/**
 * Genre taxonomy: one Spotify genre → exactly one broad category.
 * No overlaps. Edge cases documented with comments.
 *
 * The keys are the broad category names shown in the greeter.
 * The values are Spotify genre strings that map to that category.
 * Matching is case-insensitive.
 */

export const GENRE_MAP: Record<string, string[]> = {
  punk: ["punk", "pop punk", "skate punk", "anarcho punk", "crust punk", "celtic punk", "folk punk", "ska punk", "cowpunk", "horror punk", "egg punk", "proto-punk", "psychobilly", "riot grrrl", "queercore"],
  indie: ["indie", "indie rock", "indie pop", "indie folk", "indie punk", "indie sleaze", "twee pop", "chillwave", "garage rock", "power pop", "jangle pop", "bedroom pop", "neo-psychedelic", "slowcore", "emo", "midwest emo", "surf rock", "space rock", "psychedelic rock"],
  metal: ["metal", "death metal", "black metal", "doom", "sludge", "thrash", "heavy metal", "nu metal", "metalcore", "deathcore", "metalcore punk", "djent", "groove metal", "progressive metal", "grindcore", "mathcore", "speed metal", "power metal", "drone metal", "sludge metal", "doom metal", "stoner metal", "thrash metal"],
  hiphop: ["hip hop", "rap", "trap", "underground hip hop", "boom bap", "drill", "cloud rap", "pluggnb", "rage"],
  electronic: ["electronic", "techno", "house", "drum and bass", "ambient", "idm", "edm", "hyperpop", "witch house", "footwork", "breakcore", "dubstep", "future bass", "synthwave", "vaporwave", "chiptune", "darkwave", "cold wave", "synthpop", "new wave", "ebm", "electroclash", "tech house", "uk garage", "stutter house"],
  folk: ["folk", "singer-songwriter", "americana", "bluegrass", "country", "folk rock", "alt country", "jam band", "newgrass", "red dirt", "texas country", "roots rock", "blues", "blues rock", "modern blues", "classic rock", "southern rock", "rock"],
  jazz: ["jazz", "free jazz", "jazz fusion", "bebop", "smooth jazz"],
  hardcore: ["hardcore", "hardcore punk", "powerviolence", "beatdown", "metallic hardcore", "youth crew", "melodic hardcore", "easycore", "beatdown hardcore", "sasscore", "post-hardcore", "screamo"],
  shoegaze: ["shoegaze", "dream pop", "noise pop", "ethereal", "shoegaze punk", "blackgaze", "nu gaze"],
  noise: ["noise", "noise rock", "industrial", "industrial rock", "power electronics", "harsh noise", "death industrial", "deathrock", "gothic rock"],
  experimental: ["experimental", "avant-garde", "drone", "minimal", "free improvisation", "deconstructed club", "glitch", "plunderphonics", "art pop"],
  soul: ["soul", "r&b", "funk", "neo soul", "funk rock", "retro soul", "alternative r&b"],
  hipster: ["art rock", "post-rock", "math rock", "chamber pop", "post-punk", "aor", "reggae", "ska", "rockabilly"],
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
 * Used by the greeter component to render the genre category headers.
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
 * Get all individual genre strings from the taxonomy, flattened and deduplicated.
 * Used by search and the greeter expansion to treat every genre as its own filter.
 *
 * @returns Sorted array of unique genre strings (lowercase)
 */
export function getAllGenreStrings(): string[] {
  const all = new Set<string>();
  for (const genres of Object.values(GENRE_MAP)) {
    for (const g of genres) all.add(g);
  }
  return [...all].sort();
}

/**
 * Check if an artist's genres match any preferred genre strings.
 * Returns the count of preferred terms that have at least one matching artist genre
 * (each preferred term contributes at most 1).
 *
 * NOTE(port): HD 9 scoring uses this per-artist as a boolean — check `> 0`.
 * The show-level `scoreShow` must use `Math.min(scoreArtistGenres(...), 1)`
 * per artist to count artists (not genre tags).
 *
 * Matching is direct substring: an artist genre "metalcore" matches a preferred
 * term "metal" because "metal" is contained in "metalcore". There is no mapping
 * to broad categories; every preferred string is treated as an independent filter.
 *
 * @param artistGenres - The artist's Spotify genre strings
 * @param preferredCategories - The user's preferred genre strings
 * @returns Match count (0 = no match)
 *
 * ```ts
 * scoreArtistGenres(["punk"], ["punk"]) // 1
 * scoreArtistGenres(["jazz"], ["punk"]) // 0
 * scoreArtistGenres(["metalcore"], ["metal"]) // 1
 * scoreArtistGenres(["metalcore"], ["metal", "metalcore"]) // 2
 * ```
 */
export function scoreArtistGenres(
  artistGenres: string[],
  preferredCategories: string[],
): number {
  if (!Array.isArray(artistGenres) || !Array.isArray(preferredCategories)) {
    return 0;
  }

  const lowerArtistGenres = artistGenres.map((g) => g.toLowerCase());

  return preferredCategories.reduce((acc, cat) => {
    const c = cat.toLowerCase().trim();
    if (!c) return acc; // skip empty strings
    // Direct substring match: does any artist genre contain this preferred term?
    return acc + (lowerArtistGenres.some((g) => g.includes(c)) ? 1 : 0);
  }, 0);
}
