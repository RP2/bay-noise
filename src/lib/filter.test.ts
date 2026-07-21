import { describe, it, expect } from "vitest";
import {
  flattenAndScoreShows,
  sortShows,
  splitByScore,
  hasShowsBelowFold,
  filterByQuery,
  applyFilters,
  processShows,
} from "./filter.js";
import { SAMPLE_SHOWS } from "./__fixtures__/shows.js";
import type { UserPrefs, FilterState, ScoredShow } from "./types.js";

const PUNK_PREFS: UserPrefs = { preferredGenres: ["punk"], onboarded: true };
const ALL_PREFS: UserPrefs = {
  preferredGenres: ["punk", "indie", "metal", "hiphop", "electronic", "folk", "jazz", "hardcore", "shoegaze", "noise", "experimental", "soul", "hipster"],
  onboarded: true,
};
const EMPTY_PREFS: UserPrefs = { preferredGenres: [], onboarded: true };
const UNONBOARDED: UserPrefs = { preferredGenres: [], onboarded: false };

const DEFAULT_FILTER: FilterState = {
  query: "",
  venue: null,
  artist: null,
  showAll: false,
};

const SHOW_ALL_FILTER: FilterState = { ...DEFAULT_FILTER, showAll: true };

describe("flattenAndScoreShows", () => {
  it("flattens each VenueEvent into one ScoredShow", () => {
    const result = flattenAndScoreShows(SAMPLE_SHOWS.shows, PUNK_PREFS);
    expect(result).toHaveLength(5);
  });

  it("assigns scores based on matching artists for punk prefs", () => {
    const result = flattenAndScoreShows(SAMPLE_SHOWS.shows, PUNK_PREFS);
    // Bottom of the Hill: Sad Snack (punk,indie) + Foolish Relics (punk) = 2 matching artists
    expect(result[0].score).toBe(2);
    // August Hall: Cab (indie rock) + Jady (electronic) = 0
    expect(result[1].score).toBe(0);
    // 924 Gilman: Spray (hardcore punk → hardcore, no), Torch (metal, no), Open Wound (punk, yes) = 1
    expect(result[2].score).toBe(1);
    // The New Parish: Helado Negro (indie,electronic) = 0
    expect(result[3].score).toBe(0);
    // The Temple: Dust Collector (noise,experimental) = 0
    expect(result[4].score).toBe(0);
  });

  it("scores with empty preferredGenres as 0 for all shows", () => {
    const result = flattenAndScoreShows(SAMPLE_SHOWS.shows, EMPTY_PREFS);
    for (const show of result) {
      expect(show.score).toBe(0);
    }
  });

  it("scores with all categories shows all artists matching", () => {
    const result = flattenAndScoreShows(SAMPLE_SHOWS.shows, ALL_PREFS);
    // Every artist matches at least one category
    for (const show of result) {
      expect(show.score).toBeGreaterThan(0);
    }
  });

  it("includes all ScoredShow fields", () => {
    const result = flattenAndScoreShows(SAMPLE_SHOWS.shows, PUNK_PREFS);
    const show = result[0];
    expect(show).toHaveProperty("date");
    expect(show).toHaveProperty("day");
    expect(show).toHaveProperty("venueName");
    expect(show).toHaveProperty("city");
    expect(show).toHaveProperty("artists");
    expect(show).toHaveProperty("extra");
    expect(show).toHaveProperty("time");
    expect(show).toHaveProperty("price");
    expect(show).toHaveProperty("age");
    expect(show).toHaveProperty("score");
  });

  it("handles empty shows array", () => {
    const result = flattenAndScoreShows([], PUNK_PREFS);
    expect(result).toEqual([]);
  });
});

describe("sortShows", () => {
  it("sorts by score descending, then date ascending", () => {
    const result = flattenAndScoreShows(SAMPLE_SHOWS.shows, PUNK_PREFS);
    const sorted = sortShows(result);
    expect(sorted[0].score).toBeGreaterThanOrEqual(sorted[1].score);
    expect(sorted[1].score).toBeGreaterThanOrEqual(sorted[2].score);
  });

  it("does not mutate the original array", () => {
    const result = flattenAndScoreShows(SAMPLE_SHOWS.shows, PUNK_PREFS);
    const original = [...result];
    sortShows(result);
    expect(result).toEqual(original);
  });

  it("same-score shows are ordered by date", () => {
    const shows: ScoredShow[] = [
      createScoredShow("2026-07-26", "Venue B", 0),
      createScoredShow("2026-07-25", "Venue A", 0),
    ];
    const sorted = sortShows(shows);
    expect(sorted[0].date).toBe("2026-07-25");
    expect(sorted[1].date).toBe("2026-07-26");
  });
});

describe("splitByScore", () => {
  it("splits shows into above (score>0) and below (score=0)", () => {
    const shows = flattenAndScoreShows(SAMPLE_SHOWS.shows, PUNK_PREFS);
    const { above, below } = splitByScore(shows);
    expect(above.length).toBe(2); // Bottom of the Hill (2), Gilman (1)
    expect(below.length).toBe(3); // August Hall, New Parish, Temple
    for (const s of above) expect(s.score).toBeGreaterThan(0);
    for (const s of below) expect(s.score).toBe(0);
  });

  it("all above when all scores > 0", () => {
    const shows = flattenAndScoreShows(SAMPLE_SHOWS.shows, ALL_PREFS);
    const { above, below } = splitByScore(shows);
    expect(above.length).toBe(5);
    expect(below).toHaveLength(0);
  });
});

describe("hasShowsBelowFold", () => {
  it("returns true when some shows have score 0", () => {
    const shows = flattenAndScoreShows(SAMPLE_SHOWS.shows, PUNK_PREFS);
    expect(hasShowsBelowFold(shows)).toBe(true);
  });

  it("returns false when all shows have score > 0", () => {
    const shows = flattenAndScoreShows(SAMPLE_SHOWS.shows, ALL_PREFS);
    expect(hasShowsBelowFold(shows)).toBe(false);
  });

  it("returns false for empty array", () => {
    expect(hasShowsBelowFold([])).toBe(false);
  });
});

describe("filterByQuery", () => {
  const shows = flattenAndScoreShows(SAMPLE_SHOWS.shows, PUNK_PREFS);

  it("returns all shows for empty query", () => {
    const result = filterByQuery(shows, "");
    expect(result).toHaveLength(shows.length);
  });

  it("finds shows by venue name", () => {
    const result = filterByQuery(shows, "Bottom of the Hill");
    expect(result).toHaveLength(1);
    expect(result[0].venueName).toContain("Bottom of the Hill");
  });

  it("finds shows by artist name", () => {
    const result = filterByQuery(shows, "Sad Snack");
    expect(result).toHaveLength(1);
  });

  it("finds shows by extra field", () => {
    const result = filterByQuery(shows, "9pm");
    expect(result.length).toBeGreaterThan(0);
  });

  it("is case-insensitive", () => {
    const result = filterByQuery(shows, "sad snack");
    expect(result).toHaveLength(1);
  });

  it("returns empty array for no match", () => {
    const result = filterByQuery(shows, "zzzznotfoundzzzz");
    expect(result).toEqual([]);
  });

  it("trims whitespace from query", () => {
    const result = filterByQuery(shows, "  Sad Snack  ");
    expect(result).toHaveLength(1);
  });
});

describe("applyFilters", () => {
  const shows = flattenAndScoreShows(SAMPLE_SHOWS.shows, PUNK_PREFS);
  const sorted = sortShows(shows);

  it("with default filter (no venue/artist/showAll) returns only scored shows", () => {
    const result = applyFilters(sorted, DEFAULT_FILTER);
    // DEFAULT_FILTER.showAll = false, so only score > 0
    expect(result).toHaveLength(2);
    for (const s of result) expect(s.score).toBeGreaterThan(0);
  });

  it("explicit venue filter bypasses the score fold (shows all, even score=0)", () => {
    // August Hall has all score=0 shows with punk prefs
    const filter: FilterState = { ...DEFAULT_FILTER, venue: "August Hall" };
    const result = applyFilters(sorted, filter);
    // showAll=false but explicit venue filter → fold bypassed
    expect(result.length).toBeGreaterThan(0);
    // Should include the score=0 show
    expect(result.some((s) => s.score === 0)).toBe(true);
  });

  it("explicit artist filter bypasses the score fold", () => {
    // Helado Negro is at The New Parish (score=0 with punk prefs)
    const filter: FilterState = { ...DEFAULT_FILTER, artist: "Helado Negro" };
    const result = applyFilters(sorted, filter);
    expect(result.length).toBeGreaterThan(0);
    expect(result.some((s) => s.score === 0)).toBe(true);
  });

  it("with showAll returns all shows", () => {
    const result = applyFilters(sorted, SHOW_ALL_FILTER);
    expect(result).toHaveLength(5);
  });

  it("flattenAndScoreShows does not alias input artist objects (mutation isolation)", () => {
    // Verify that modifying an artist name in the output doesn't affect the input
    const result = flattenAndScoreShows(SAMPLE_SHOWS.shows, PUNK_PREFS);
    const originalName = SAMPLE_SHOWS.shows[0].venues[0].artists[0].name;
    result[0].artists[0] = { name: "MUTATED", genres: [] };
    expect(SAMPLE_SHOWS.shows[0].venues[0].artists[0].name).toBe(originalName);
  });

  it("filterByQuery returns a new array (not same reference) for empty query", () => {
    const result = filterByQuery(sorted, "");
    expect(result).not.toBe(sorted);
    expect(result).toHaveLength(sorted.length);
  });

  it("filterByQuery searches city field", () => {
    // Search for "Berkeley" — should find 924 Gilman Street show
    const result = filterByQuery(sorted, "Berkeley");
    expect(result.length).toBeGreaterThan(0);
    expect(result.some((s) => s.city === "Berkeley")).toBe(true);
  });

  it("filters by venue name", () => {
    const filter: FilterState = { ...DEFAULT_FILTER, showAll: true, venue: "Bottom of the Hill" };
    const result = applyFilters(sorted, filter);
    expect(result).toHaveLength(1);
    expect(result[0].venueName).toContain("Bottom of the Hill");
  });

  it("filters by artist name", () => {
    const filter: FilterState = { ...DEFAULT_FILTER, showAll: true, artist: "Sad Snack" };
    const result = applyFilters(sorted, filter);
    expect(result).toHaveLength(1);
  });

  it("artist filter matches any artist in a multi-artist show", () => {
    // Gilman show has Spray, Torch, Open Wound — searching for "Torch" should find it
    const filter: FilterState = { ...DEFAULT_FILTER, showAll: true, artist: "Torch" };
    const result = applyFilters(sorted, filter);
    expect(result).toHaveLength(1);
    expect(result[0].venueName).toContain("Gilman");
  });

  it("combines venue and artist filter with AND", () => {
    // Bottom of the Hill has Sad Snack
    const filter: FilterState = {
      ...DEFAULT_FILTER,
      showAll: true,
      venue: "Bottom of the Hill",
      artist: "Sad Snack",
    };
    const result = applyFilters(sorted, filter);
    expect(result).toHaveLength(1);
  });

  it("AND logic: venue + non-matching artist returns empty", () => {
    // Bottom of the Hill but search for an artist not playing there
    const filter: FilterState = {
      ...DEFAULT_FILTER,
      showAll: true,
      venue: "Bottom of the Hill",
      artist: "Helado Negro",
    };
    const result = applyFilters(sorted, filter);
    expect(result).toEqual([]);
  });

  it("combines query with venue filter (AND)", () => {
    // Search for "9pm" AND venue "Bottom of the Hill"
    const filter: FilterState = {
      ...DEFAULT_FILTER,
      showAll: true,
      query: "9pm",
      venue: "Bottom of the Hill",
    };
    const result = applyFilters(sorted, filter);
    expect(result).toHaveLength(1);
  });

  it("returns empty when venue filter matches nothing", () => {
    const filter: FilterState = { ...DEFAULT_FILTER, showAll: true, venue: "Nonexistent Venue" };
    const result = applyFilters(sorted, filter);
    expect(result).toEqual([]);
  });

  it("venue filter is substring and case-insensitive", () => {
    const filter: FilterState = { ...DEFAULT_FILTER, showAll: true, venue: "bottom" };
    const result = applyFilters(sorted, filter);
    expect(result).toHaveLength(1);
  });
});

describe("processShows", () => {
  it("full pipeline: flatten → sort → filter", () => {
    const result = processShows(SAMPLE_SHOWS.shows, PUNK_PREFS, DEFAULT_FILTER);
    // Should be sorted by score desc, only score > 0
    expect(result).toHaveLength(2);
    expect(result[0].score).toBeGreaterThanOrEqual(result[1].score);
  });

  it("handles unboarded prefs (empty genres)", () => {
    const result = processShows(SAMPLE_SHOWS.shows, UNONBOARDED, SHOW_ALL_FILTER);
    // All scores 0, showAll = true, all 5 shows returned
    expect(result).toHaveLength(5);
    for (const s of result) expect(s.score).toBe(0);
  });

  it("handles empty shows", () => {
    const result = processShows([], PUNK_PREFS, DEFAULT_FILTER);
    expect(result).toEqual([]);
  });
});

// Helper to create a minimal ScoredShow for testing
function createScoredShow(
  date: string,
  venueName: string,
  score: number,
): ScoredShow {
  return {
    date,
    day: "Sat Jul 25",
    venueName,
    city: null,
    artists: [],
    extra: "",
    time: null,
    price: null,
    age: null,
    score,
  };
}
