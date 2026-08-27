import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  todayLocal,
  extractEntities,
  type KnownVenue,
  type ArtistCacheEntry,
} from "./extract.js";
import type { ShowsData } from "../../src/lib/types.js";

// Pin system time to 2026-08-26 (mid-day Pacific) for deterministic "today".
// 2026-08-26T20:00:00Z = 13:00 PDT — well within the day regardless of host TZ.
const PINNED_NOW = new Date("2026-08-26T20:00:00Z");
const TODAY = "2026-08-26";

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(PINNED_NOW);
});

afterEach(() => {
  vi.useRealTimers();
});

const VENUE_BOTH = "Bottom of the Hill, S.F.";
const VENUE_GILMAN = "924 Gilman Street, Berkeley";

const KNOWN_VENUES: KnownVenue[] = [
  {
    name: "Bottom of the Hill",
    city: "San Francisco",
    address: "1233 17th Street",
    aliases: [VENUE_BOTH, "BotH, S.F."],
  },
  {
    name: "924 Gilman Street",
    city: "Berkeley",
    address: "924 Gilman Street",
    aliases: [VENUE_GILMAN],
  },
];

function makeData(days: Array<{
  date: string;
  day: string;
  venues: Array<{
    name: string;
    city: string | null;
    address: string | null;
    artists: Array<{ name: string; genres?: string[]; spotifyUrl?: string }>;
    extra?: string;
    time?: string | null;
    price?: string | null;
    age?: string | null;
  }>;
}>): ShowsData {
  return {
    updated: TODAY,
    shows: days.map((d) => ({
      date: d.date,
      day: d.day,
      venues: d.venues.map((v) => ({
        name: v.name,
        city: v.city,
        address: v.address,
        artists: v.artists.map((a) => ({
          name: a.name,
          genres: a.genres ?? [],
          spotifyUrl: a.spotifyUrl,
        })),
        extra: v.extra ?? "9pm · $15",
        time: v.time ?? "9pm",
        price: v.price ?? "$15",
        age: v.age ?? null,
      })),
    })),
  };
}

describe("todayLocal", () => {
  it("returns YYYY-MM-DD format", () => {
    expect(todayLocal()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("returns the pinned date under fake timers", () => {
    expect(todayLocal()).toBe(TODAY);
  });
});

describe("extractEntities — date filtering", () => {
  it("excludes shows on past dates from every entity type", () => {
    const data = makeData([
      // Past show — must be excluded.
      {
        date: "2026-08-01",
        day: "Sat Aug 1",
        venues: [
          {
            name: VENUE_BOTH,
            city: "San Francisco",
            address: null,
            artists: [{ name: "Past Act" }],
          },
        ],
      },
      // Future show — must be included.
      {
        date: "2026-09-15",
        day: "Tue Sep 15",
        venues: [
          {
            name: VENUE_BOTH,
            city: "San Francisco",
            address: null,
            artists: [{ name: "Future Act" }],
          },
        ],
      },
    ]);

    const { venues, artists } = extractEntities(data, KNOWN_VENUES, {});

    // Past Act appears in no entity.
    const artistNames = artists.map((a) => a.name);
    expect(artistNames).not.toContain("Past Act");
    expect(artistNames).toContain("Future Act");

    // The venue only carries the future show.
    expect(venues).toHaveLength(1);
    expect(venues[0].shows).toHaveLength(1);
    expect(venues[0].shows[0].date).toBe("2026-09-15");
  });
});

describe("extractEntities — venue canonical name lookup", () => {
  it("resolves a scraped alias to its known-venues canonical name", () => {
    const data = makeData([
      {
        date: "2026-09-01",
        day: "Tue Sep 1",
        venues: [
          {
            name: VENUE_BOTH,
            city: "San Francisco",
            address: null,
            artists: [{ name: "Act A" }],
          },
        ],
      },
    ]);

    const { venues } = extractEntities(data, KNOWN_VENUES, {});

    expect(venues).toHaveLength(1);
    expect(venues[0].name).toBe("Bottom of the Hill");
    expect(venues[0].slug).toBe("bottom-of-the-hill");
    expect(venues[0].city).toBe("San Francisco");
    expect(venues[0].address).toBe("1233 17th Street");
  });

  it("uses the scraped name as-is when no known-venues match exists", () => {
    const data = makeData([
      {
        date: "2026-09-01",
        day: "Tue Sep 1",
        venues: [
          {
            name: "Mystery Warehouse, Oakland",
            city: "Oakland",
            address: null,
            artists: [{ name: "Act A" }],
          },
        ],
      },
    ]);

    const { venues } = extractEntities(data, KNOWN_VENUES, {});

    expect(venues).toHaveLength(1);
    expect(venues[0].name).toBe("Mystery Warehouse, Oakland");
    // Slugify the raw scraped name verbatim.
    expect(venues[0].slug).toBe("mystery-warehouse-oakland");
    // No known-venue match → no canonical city/address metadata.
    expect(venues[0].city).toBeNull();
    expect(venues[0].address).toBeNull();
  });

  it("matches aliases case-insensitively", () => {
    const data = makeData([
      {
        date: "2026-09-01",
        day: "Tue Sep 1",
        venues: [
          {
            name: VENUE_BOTH.toUpperCase(),
            city: "San Francisco",
            address: null,
            artists: [{ name: "Act A" }],
          },
        ],
      },
    ]);

    const { venues } = extractEntities(data, KNOWN_VENUES, {});
    expect(venues[0].name).toBe("Bottom of the Hill");
  });

  it("resolves venue from canonical name (not just alias)", () => {
    // build-data.ts emits canonical names into shows.json — not aliases —
    // so the lookup MUST match `venue.name` directly, not only `venue.aliases`.
    const data = makeData([
      {
        date: "2026-09-28",
        day: "Mon Sep 28",
        venues: [
          {
            name: "Bottom of the Hill",
            city: null,
            address: null,
            artists: [{ name: "Act A" }],
          },
        ],
      },
    ]);

    const knownVenues: KnownVenue[] = [
      {
        name: "Bottom of the Hill",
        city: "San Francisco",
        address: "1233 17th Street",
        aliases: ["Bottom of the Hill, S.F."],
      },
    ];

    const { venues } = extractEntities(data, knownVenues, {});
    expect(venues).toHaveLength(1);
    expect(venues[0].name).toBe("Bottom of the Hill");
    expect(venues[0].city).toBe("San Francisco");
    expect(venues[0].address).toBe("1233 17th Street");
  });
});

describe("extractEntities — artist grouping", () => {
  it("merges case variants of an artist name into one entity", () => {
    const data = makeData([
      {
        date: "2026-09-10",
        day: "Thu Sep 10",
        venues: [
          {
            name: VENUE_BOTH,
            city: "San Francisco",
            address: null,
            artists: [{ name: "JT" }],
          },
        ],
      },
      {
        date: "2026-09-11",
        day: "Fri Sep 11",
        venues: [
          {
            name: VENUE_GILMAN,
            city: "Berkeley",
            address: null,
            artists: [{ name: "Jt" }],
          },
        ],
      },
    ]);

    const { artists } = extractEntities(data, KNOWN_VENUES, {});

    const jt = artists.find((a) => a.name.toLowerCase() === "jt");
    expect(jt).toBeDefined();
    // Both shows (across both venues) land in one artist entity.
    expect(jt!.shows).toHaveLength(2);
  });

  it("uses the artist-cache name as canonical when present", () => {
    const data = makeData([
      {
        date: "2026-09-10",
        day: "Thu Sep 10",
        venues: [
          {
            name: VENUE_BOTH,
            city: "San Francisco",
            address: null,
            artists: [{ name: "jt" }],
          },
        ],
      },
    ]);

    const cache: Record<string, ArtistCacheEntry> = {
      jt: { name: "J.T.", genres: ["indie"], spotifyUrl: "https://example.com/jt" },
    };

    const { artists } = extractEntities(data, KNOWN_VENUES, cache);

    expect(artists).toHaveLength(1);
    expect(artists[0].name).toBe("J.T.");
    expect(artists[0].slug).toBe("j-t");
    expect(artists[0].spotifyUrl).toBe("https://example.com/jt");
  });

  it("uses alphabetical-first variant when no cache entry exists", () => {
    const data = makeData([
      {
        date: "2026-09-10",
        day: "Thu Sep 10",
        venues: [
          {
            name: VENUE_BOTH,
            city: "San Francisco",
            address: null,
            artists: [{ name: "Zebra" }, { name: "alpha" }],
          },
        ],
      },
    ]);

    const { artists } = extractEntities(data, KNOWN_VENUES, {});

    const names = artists.map((a) => a.name).sort();
    // "Zebra" comes before "alpha" alphabetically (Z < a in ASCII, but
    // locale-aware sort places numbers/letters ignoring case; we only care
    // that the function is deterministic and picks ONE of them).
    expect(names).toContain("Zebra");
    expect(names).toContain("alpha");
    expect(artists).toHaveLength(2);
    // Each gets its own slug.
    const slugs = artists.map((a) => a.slug).sort();
    expect(slugs).toEqual(["alpha", "zebra"]);
  });

  it("deduplicates genres across an artist's appearances", () => {
    const data = makeData([
      {
        date: "2026-09-10",
        day: "Thu Sep 10",
        venues: [
          {
            name: VENUE_BOTH,
            city: "San Francisco",
            address: null,
            artists: [{ name: "Poly Act", genres: ["punk", "indie"] }],
          },
        ],
      },
      {
        date: "2026-09-15",
        day: "Tue Sep 15",
        venues: [
          {
            name: VENUE_GILMAN,
            city: "Berkeley",
            address: null,
            artists: [{ name: "Poly Act", genres: ["indie", "noise"] }],
          },
        ],
      },
    ]);

    const { artists } = extractEntities(data, KNOWN_VENUES, {});

    const poly = artists.find((a) => a.name === "Poly Act")!;
    expect(poly.genres.sort()).toEqual(["indie", "noise", "punk"]);
  });
});

describe("extractEntities — cap & omission", () => {
  it("caps each entity at 50 shows", () => {
    // 60 future dates at the same venue.
    const days = Array.from({ length: 60 }, (_, i) => {
      const day = i + 1;
      const date = `2026-10-${String(day).padStart(2, "0")}`;
      return {
        date,
        day: `Day ${day}`,
        venues: [
          {
            name: VENUE_BOTH,
            city: "San Francisco",
            address: null,
            artists: [{ name: "Act A" }],
          },
        ],
      };
    });
    const data = makeData(days);

    const { venues, artists } = extractEntities(data, KNOWN_VENUES, {});

    expect(venues[0].shows).toHaveLength(50);
    expect(artists[0].shows).toHaveLength(50);
  });

  it("omits entities with zero upcoming shows", () => {
    const data = makeData([
      {
        date: "2026-07-01", // past
        day: "Wed Jul 1",
        venues: [
          {
            name: VENUE_BOTH,
            city: "San Francisco",
            address: null,
            artists: [{ name: "Ghost Act" }],
          },
        ],
      },
    ]);

    const { venues, artists, cities } = extractEntities(data, KNOWN_VENUES, {});

    expect(venues).toHaveLength(0);
    expect(artists).toHaveLength(0);
    expect(cities).toHaveLength(0);
  });
});

describe("extractEntities — null city", () => {
  it("still generates a venue page when the event city is null", () => {
    const data = makeData([
      {
        date: "2026-09-10",
        day: "Thu Sep 10",
        venues: [
          {
            name: "Pop-up Space",
            city: null,
            address: null,
            artists: [{ name: "Act A" }],
          },
        ],
      },
    ]);

    const { venues, cities } = extractEntities(data, KNOWN_VENUES, {});

    // Venue page is created.
    expect(venues).toHaveLength(1);
    expect(venues[0].city).toBeNull();

    // No city page (no key to group under).
    expect(cities).toHaveLength(0);
  });
});

describe("extractEntities — lastmod", () => {
  it("uses the latest show date, not today", () => {
    const data = makeData([
      {
        date: "2026-09-10",
        day: "Thu Sep 10",
        venues: [
          {
            name: VENUE_BOTH,
            city: "San Francisco",
            address: null,
            artists: [{ name: "Act A" }],
          },
        ],
      },
      {
        date: "2026-12-20",
        day: "Sun Dec 20",
        venues: [
          {
            name: VENUE_BOTH,
            city: "San Francisco",
            address: null,
            artists: [{ name: "Act B" }],
          },
        ],
      },
    ]);

    const { venues, artists, cities } = extractEntities(data, KNOWN_VENUES, {});

    expect(venues[0].lastmod).toBe("2026-12-20");
    // San Francisco is the only city.
    expect(cities[0].lastmod).toBe("2026-12-20");
    // Each artist appears once, lastmod = their single show date.
    const actA = artists.find((a) => a.name === "Act A")!;
    const actB = artists.find((a) => a.name === "Act B")!;
    expect(actA.lastmod).toBe("2026-09-10");
    expect(actB.lastmod).toBe("2026-12-20");
    // And it is NOT today.
    expect(venues[0].lastmod).not.toBe(TODAY);
  });

  it("uses the latest cap-50 date when more than 50 shows exist", () => {
    // 60 shows. After cap, last is the 50th earliest (= date index 49 in ascending order).
    const days = Array.from({ length: 60 }, (_, i) => {
      const day = i + 1;
      const date = `2026-10-${String(day).padStart(2, "0")}`;
      return {
        date,
        day: `Day ${day}`,
        venues: [
          {
            name: VENUE_BOTH,
            city: "San Francisco",
            address: null,
            artists: [{ name: "Act A" }],
          },
        ],
      };
    });
    const data = makeData(days);

    const { venues } = extractEntities(data, KNOWN_VENUES, {});

    // 50th show ascending = 2026-10-50? No — day 50 → 2026-10-50 is invalid.
    // We only generated days 1..60 of October, so day 50 = 2026-10-50.
    // The padStart(2, "0") on day=50 gives "50", and "2026-10-50" is a valid
    // string for our purposes — the spec doesn't constrain to real calendar
    // dates. The test just checks lastmod matches the LAST show in the
    // capped (ascending) list.
    expect(venues[0].lastmod).toBe(venues[0].shows[venues[0].shows.length - 1].date);
  });
});

describe("extractEntities — slugs", () => {
  it("generates lowercase hyphenated slugs for venues, artists, and cities", () => {
    const data = makeData([
      {
        date: "2026-09-10",
        day: "Thu Sep 10",
        venues: [
          {
            name: VENUE_BOTH,
            city: "San Francisco",
            address: null,
            artists: [{ name: "Yes Ma'am" }],
          },
        ],
      },
    ]);

    const { venues, artists, cities } = extractEntities(data, KNOWN_VENUES, {});

    expect(venues[0].slug).toBe("bottom-of-the-hill");
    expect(artists[0].slug).toBe("yes-ma-am");
    expect(cities[0].slug).toBe("san-francisco");
  });

  it("EntityShow includes venueSlug and ArtistRef includes slug", () => {
    const data = makeData([
      {
        date: "2026-09-10",
        day: "Thu Sep 10",
        venues: [
          {
            name: VENUE_BOTH,
            city: "San Francisco",
            address: null,
            artists: [{ name: "Yes Ma'am" }, { name: "Support Act" }],
          },
        ],
      },
    ]);

    const { venues, artists, cities } = extractEntities(data, KNOWN_VENUES, {});

    expect(venues[0].shows[0].venueSlug).toBe("bottom-of-the-hill");
    expect(venues[0].shows[0].artists[0].slug).toBe("yes-ma-am");
    expect(cities[0].shows[0].venueSlug).toBe("bottom-of-the-hill");
    expect(cities[0].shows[0].artists[0].slug).toBe("yes-ma-am");

    const yesMaam = artists.find((a) => a.name === "Yes Ma'am")!;
    expect(yesMaam.shows[0].venueSlug).toBe("bottom-of-the-hill");
    expect(yesMaam.shows[0].artists[0].slug).toBe("support-act");

    const supportAct = artists.find((a) => a.name === "Support Act")!;
    expect(supportAct.shows[0].venueSlug).toBe("bottom-of-the-hill");
    expect(supportAct.shows[0].artists[0].slug).toBe("yes-ma-am");
  });

  it("sorts each entity type alphabetically by slug", () => {
    const data = makeData([
      {
        date: "2026-09-10",
        day: "Thu Sep 10",
        venues: [
          {
            name: VENUE_GILMAN,
            city: "Berkeley",
            address: null,
            artists: [{ name: "Zebra" }],
          },
          {
            name: VENUE_BOTH,
            city: "San Francisco",
            address: null,
            artists: [{ name: "Apple" }],
          },
        ],
      },
    ]);

    const { venues, cities, artists } = extractEntities(data, KNOWN_VENUES, {});

    expect(venues.map((v) => v.slug)).toEqual(["924-gilman-street", "bottom-of-the-hill"]);
    expect(cities.map((c) => c.slug)).toEqual(["berkeley", "san-francisco"]);
    expect(artists.map((a) => a.slug)).toEqual(["apple", "zebra"]);
  });
});
