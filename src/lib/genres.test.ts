import { describe, it, expect } from "vitest";
import {
  GENRE_MAP,
  classifyGenre,
  getBroadCategories,
  getGenresForCategory,
  scoreArtistGenres,
  OTHER_CATEGORY,
} from "./genres.js";

describe("GENRE_MAP", () => {
  it("has 13 categories", () => {
    expect(Object.keys(GENRE_MAP)).toHaveLength(13);
  });

  it("has no duplicate genres across categories", () => {
    const allGenres = Object.values(GENRE_MAP).flat().map((g) => g.toLowerCase());
    const unique = new Set(allGenres);
    expect(unique.size).toBe(allGenres.length);
  });

  it("each category has at least one genre", () => {
    for (const [category, genres] of Object.entries(GENRE_MAP)) {
      expect(
        genres.length,
        `category "${category}" has no genres`,
      ).toBeGreaterThan(0);
    }
  });

  it("each genre is a non-empty string", () => {
    for (const [category, genres] of Object.entries(GENRE_MAP)) {
      for (const genre of genres) {
        expect(
          typeof genre === "string" && genre.length > 0,
          `category "${category}" has invalid genre: "${genre}"`,
        ).toBe(true);
      }
    }
  });
});

describe("classifyGenre", () => {
  it("classifies known genres to their category", () => {
    expect(classifyGenre("punk")).toBe("punk");
    expect(classifyGenre("indie rock")).toBe("indie");
    expect(classifyGenre("death metal")).toBe("metal");
    expect(classifyGenre("hip hop")).toBe("hiphop");
    expect(classifyGenre("electronic")).toBe("electronic");
    expect(classifyGenre("folk")).toBe("folk");
    expect(classifyGenre("jazz")).toBe("jazz");
    expect(classifyGenre("hardcore")).toBe("hardcore");
    expect(classifyGenre("shoegaze")).toBe("shoegaze");
    expect(classifyGenre("noise")).toBe("noise");
    expect(classifyGenre("experimental")).toBe("experimental");
    expect(classifyGenre("soul")).toBe("soul");
    expect(classifyGenre("art rock")).toBe("hipster");
  });

  it("is case-insensitive", () => {
    expect(classifyGenre("PUNK")).toBe("punk");
    expect(classifyGenre("Indie Rock")).toBe("indie");
    expect(classifyGenre("DEATH METAL")).toBe("metal");
    expect(classifyGenre("Art Rock")).toBe("hipster");
  });

  it("classifies sub-genres", () => {
    expect(classifyGenre("skate punk")).toBe("punk");
    expect(classifyGenre("black metal")).toBe("metal");
    expect(classifyGenre("dream pop")).toBe("shoegaze");
    expect(classifyGenre("noise rock")).toBe("noise");
    expect(classifyGenre("drone")).toBe("experimental");
    expect(classifyGenre("neo soul")).toBe("soul");
  });

  it("classifies r&b and other special-char genres", () => {
    expect(classifyGenre("r&b")).toBe("soul");
    expect(classifyGenre("R&B")).toBe("soul");
    expect(classifyGenre("funk rock")).toBe("soul");
  });

  it("returns 'other' for unknown genres", () => {
    expect(classifyGenre("unknown genre")).toBe(OTHER_CATEGORY);
    expect(classifyGenre("classical")).toBe(OTHER_CATEGORY);
    expect(classifyGenre("")).toBe(OTHER_CATEGORY);
    expect(classifyGenre("reggae")).toBe(OTHER_CATEGORY);
  });

  // Empty string coverage is in the "returns 'other' for unknown genres" block above
});

describe("getBroadCategories", () => {
  it("returns all category names", () => {
    const categories = getBroadCategories();
    expect(categories).toContain("punk");
    expect(categories).toContain("indie");
    expect(categories).toContain("metal");
    expect(categories).toContain("hiphop");
    expect(categories).toContain("electronic");
    expect(categories).toContain("folk");
    expect(categories).toContain("jazz");
    expect(categories).toContain("hardcore");
    expect(categories).toContain("shoegaze");
    expect(categories).toContain("noise");
    expect(categories).toContain("experimental");
    expect(categories).toContain("soul");
    expect(categories).toContain("hipster");
    expect(categories).toHaveLength(13);
  });

  it("returns a new array each call (no mutation risk)", () => {
    const a = getBroadCategories();
    const b = getBroadCategories();
    expect(a).toEqual(b);
    a.push("fake");
    expect(b).not.toContain("fake");
  });
});

describe("getGenresForCategory", () => {
  it("returns genres for known category", () => {
    const punkGenres = getGenresForCategory("punk");
    expect(punkGenres).toContain("punk");
    expect(punkGenres).toContain("pop punk");
    expect(punkGenres).toContain("folk punk");
  });

  it("returns a defensive copy (mutating result does not affect GENRE_MAP)", () => {
    const a = getGenresForCategory("punk");
    const b = getGenresForCategory("punk");
    a.push("FAKE");
    expect(b).not.toContain("FAKE");
    expect(b.length).toBeGreaterThanOrEqual(6);
  });

  it("returns empty array for unknown category", () => {
    expect(getGenresForCategory("nonexistent")).toEqual([]);
  });
});

describe("scoreArtistGenres", () => {
  it("returns match count for matching genres", () => {
    expect(scoreArtistGenres(["punk"], ["punk"])).toBe(1);
    expect(scoreArtistGenres(["punk", "indie"], ["punk"])).toBe(1);
    expect(scoreArtistGenres(["punk", "indie"], ["punk", "indie"])).toBe(2);
  });

  it("returns 0 for no matches", () => {
    expect(scoreArtistGenres(["jazz"], ["punk"])).toBe(0);
    expect(scoreArtistGenres([], ["punk"])).toBe(0);
  });

  it("handles sub-genre matching", () => {
    expect(scoreArtistGenres(["pop punk", "indie rock"], ["punk"])).toBe(1);
    expect(scoreArtistGenres(["death metal"], ["metal"])).toBe(1);
    expect(scoreArtistGenres(["dream pop"], ["shoegaze"])).toBe(1);
  });

  it("is case-insensitive", () => {
    expect(scoreArtistGenres(["PUNK"], ["punk"])).toBe(1);
    expect(scoreArtistGenres(["Indie Rock"], ["indie"])).toBe(1);
  });

  it("handles empty preferred genres", () => {
    expect(scoreArtistGenres(["punk", "indie"], [])).toBe(0);
  });

  it("handles empty artist genres", () => {
    expect(scoreArtistGenres([], ["punk", "indie"])).toBe(0);
  });

  it("returns 0 for all-unknown genres", () => {
    expect(scoreArtistGenres(["classical", "reggae"], ["punk"])).toBe(0);
  });

  it("is case-insensitive for preferred categories", () => {
    expect(scoreArtistGenres(["punk"], ["PUNK"])).toBe(1);
    expect(scoreArtistGenres(["indie rock"], ["Indie"])).toBe(1);
  });

  it("counts each matching artist genre once", () => {
    // Artist has genres punk and pop punk — both map to "punk"
    // But scoreArtistGenres counts each genre in the artist's list that maps
    // to a preferred category. Both punk and pop punk map to "punk",
    // so the count is 2.
    expect(scoreArtistGenres(["punk", "pop punk"], ["punk"])).toBe(2);
  });
});
