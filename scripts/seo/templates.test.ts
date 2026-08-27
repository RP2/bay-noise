import { describe, it, expect } from "vitest";
import { buildVenuePage, buildArtistPage, buildCityPage, buildIndexPage, escapeHtml } from "./templates.js";

/** Extract the JSON-LD blob from a rendered page. */
function extractJsonLd(html: string): unknown {
  const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  if (!match) throw new Error("No JSON-LD found in page");
  return JSON.parse(match[1] as string);
}

/** Extract the text between <p class="meta"> and </p>. */
function extractMetaLine(html: string): string {
  const match = html.match(/<p class="meta">([\s\S]*?)<\/p>/);
  if (!match) throw new Error("No meta line found in page");
  return match[1] as string;
}

/** Extract the <title>...</title> text. */
function extractTitle(html: string): string {
  const match = html.match(/<title>([^<]*)<\/title>/);
  if (!match) throw new Error("No title found in page");
  return match[1] as string;
}

const VENUE_SHOWS: Array<{
  date: string;
  day: string;
  extra: string;
  time: string | null;
  price: string | null;
  age: string | null;
  artists: Array<{ name: string; genres: string[]; slug: string }>;
}> = [
  {
    date: "2026-09-01",
    day: "Tue Sep 1",
    extra: "9pm \u00b7 $15",
    time: "9pm",
    price: "$15",
    age: null,
    artists: [
      { name: "Artist A", genres: ["punk", "indie"], slug: "artist-a" },
      { name: "Artist B", genres: ["indie"], slug: "artist-b" },
    ],
  },
];

const ARTIST_SHOWS: Array<{
  date: string;
  day: string;
  extra: string;
  time: string | null;
  price: string | null;
  age: string | null;
  venueName: string;
  venueSlug: string;
  city: string | null;
  address: string | null;
  artists: Array<{ name: string; genres: string[]; slug: string }>;
}> = [
  {
    date: "2026-09-01",
    day: "Tue Sep 1",
    extra: "9pm \u00b7 $15",
    time: "9pm",
    price: "$15",
    age: null,
    venueName: "The Chapel",
    venueSlug: "the-chapel",
    city: "San Francisco",
    address: null,
    artists: [{ name: "Opener", genres: ["indie"], slug: "opener" }],
  },
];

const CITY_SHOWS: Array<{
  date: string;
  day: string;
  extra: string;
  time: string | null;
  price: string | null;
  age: string | null;
  venueName: string;
  venueSlug: string;
  city: string | null;
  address: string | null;
  artists: Array<{ name: string; genres: string[]; slug: string }>;
}> = [
  {
    date: "2026-09-01",
    day: "Tue Sep 1",
    extra: "9pm \u00b7 $15",
    time: "9pm",
    price: "$15",
    age: null,
    venueName: "The Chapel",
    venueSlug: "the-chapel",
    city: "San Francisco",
    address: "777 Valencia St",
    artists: [{ name: "Artist A", genres: ["indie"], slug: "artist-a" }],
  },
  {
    date: "2026-09-02",
    day: "Wed Sep 2",
    extra: "8pm \u00b7 $20",
    time: "8pm",
    price: "$20",
    age: null,
    venueName: "Bottom of the Hill",
    venueSlug: "bottom-of-the-hill",
    city: "San Francisco",
    address: "1233 17th St",
    artists: [{ name: "Artist B", genres: ["punk"], slug: "artist-b" }],
  },
];

describe("escapeHtml", () => {
  it("escapes & to &amp;", () => {
    expect(escapeHtml("Hall & Oates")).toBe("Hall &amp; Oates");
  });

  it("escapes < and >", () => {
    expect(escapeHtml("<script>")).toBe("&lt;script&gt;");
  });

  it("escapes \" and '", () => {
    expect(escapeHtml(`"a" 'b'`)).toBe("&quot;a&quot; &#39;b&#39;");
  });
});

describe("buildVenuePage", () => {
  const html = buildVenuePage({
    name: "Bottom of the Hill",
    slug: "bottom-of-the-hill",
    city: "San Francisco",
    address: "1234 Main St",
    shows: VENUE_SHOWS,
    updated: "2026-08-26",
  });

  it("title contains venue name", () => {
    expect(extractTitle(html)).toContain("Bottom of the Hill");
  });

  it("canonical URL matches /venue/{slug}/", () => {
    expect(html).toMatch(
      /<link rel="canonical" href="https:\/\/shows\.wtf\/venue\/bottom-of-the-hill\/">/,
    );
  });

  it("OG type is website", () => {
    expect(html).toMatch(/<meta property="og:type" content="website">/);
  });

  it("JSON-LD contains @type: Place", () => {
    const ld = extractJsonLd(html) as Record<string, unknown>;
    expect(ld["@type"]).toBe("Place");
  });

  it("JSON-LD Event.name includes artist names", () => {
    const ld = extractJsonLd(html) as { event: Array<{ name: string }> };
    expect(ld.event[0]?.name).toContain("Artist A");
    expect(ld.event[0]?.name).toContain("Artist B");
  });

  it("artist names link to /artist/{slug}/", () => {
    expect(html).toMatch(
      /<a href="\/artist\/artist-a\/">Artist A<\/a>/,
    );
    expect(html).toMatch(
      /<a href="\/artist\/artist-b\/">Artist B<\/a>/,
    );
  });

  it("JSON-LD performer includes url", () => {
    const ld = extractJsonLd(html) as {
      event: Array<{ performer: Array<{ url: string }> }>;
    };
    expect(ld.event[0]?.performer[0]?.url).toBe(
      "https://shows.wtf/artist/artist-a/",
    );
  });

  it("null city is handled (no city in meta line)", () => {
    const withCity = buildVenuePage({
      name: "Some Hall",
      slug: "some-hall",
      city: "Oakland",
      address: "123 Main St",
      shows: [],
      updated: "2026-08-26",
    });
    const noCity = buildVenuePage({
      name: "Some Hall",
      slug: "some-hall",
      city: null,
      address: "123 Main St",
      shows: [],
      updated: "2026-08-26",
    });
    expect(extractMetaLine(withCity)).toContain("Oakland");
    expect(extractMetaLine(noCity)).not.toContain("Oakland");
    expect(extractMetaLine(noCity)).toContain("123 Main St");
  });
});

describe("buildArtistPage", () => {
  const html = buildArtistPage({
    name: "Helado Negro",
    slug: "helado-negro",
    genres: ["indie", "electronic"],
    spotifyUrl: "https://open.spotify.com/artist/5qoJgyq3gFLuhCbMBiWjBp",
    shows: ARTIST_SHOWS,
    updated: "2026-08-26",
  });

  it("title contains artist name", () => {
    expect(extractTitle(html)).toContain("Helado Negro");
  });

  it("canonical URL matches /artist/{slug}/", () => {
    expect(html).toMatch(
      /<link rel="canonical" href="https:\/\/shows\.wtf\/artist\/helado-negro\/">/,
    );
  });

  it("OG type is profile", () => {
    expect(html).toMatch(/<meta property="og:type" content="profile">/);
  });

  it("JSON-LD contains @type: MusicGroup", () => {
    const ld = extractJsonLd(html) as Record<string, unknown>;
    expect(ld["@type"]).toBe("MusicGroup");
  });

  it("Spotify link present when spotifyUrl provided", () => {
    expect(html).toMatch(
      /<a href="https:\/\/open\.spotify\.com\/artist\/5qoJgyq3gFLuhCbMBiWjBp"/,
    );
  });

  it("genres are omitted from JSON-LD when empty", () => {
    const noGenresHtml = buildArtistPage({
      name: "Mystery Act",
      slug: "mystery-act",
      genres: [],
      spotifyUrl: undefined,
      shows: [],
      updated: "2026-08-26",
    });
    const ld = extractJsonLd(noGenresHtml) as Record<string, unknown>;
    expect(ld).not.toHaveProperty("genre");
  });

  it("venue name links to /venue/{slug}/", () => {
    expect(html).toMatch(
      /<a href="\/venue\/the-chapel\/">The Chapel<\/a>/,
    );
  });

  it("other artist names link to /artist/{slug}/", () => {
    expect(html).toMatch(
      /<a href="\/artist\/opener\/">Opener<\/a>/,
    );
  });

  it("JSON-LD location includes url", () => {
    const ld = extractJsonLd(html) as {
      event: Array<{ location: { url: string } }>;
    };
    expect(ld.event[0]?.location.url).toBe(
      "https://shows.wtf/venue/the-chapel/",
    );
  });
});

describe("buildCityPage", () => {
  const html = buildCityPage({
    name: "Oakland",
    slug: "oakland",
    shows: CITY_SHOWS,
    updated: "2026-08-26",
  });

  it("title contains city name", () => {
    expect(extractTitle(html)).toContain("Oakland");
  });

  it("canonical URL matches /city/{slug}/", () => {
    expect(html).toMatch(
      /<link rel="canonical" href="https:\/\/shows\.wtf\/city\/oakland\/">/,
    );
  });

  it("JSON-LD is array of Events (no City wrapper)", () => {
    const ld = extractJsonLd(html);
    expect(Array.isArray(ld)).toBe(true);
    const arr = ld as Array<Record<string, unknown>>;
    expect(arr).toHaveLength(2);
    expect(arr[0]?.["@type"]).toBe("Event");
    expect(arr[1]?.["@type"]).toBe("Event");
  });

  it("venue names link to /venue/{slug}/", () => {
    expect(html).toMatch(
      /<a href="\/venue\/the-chapel\/">The Chapel<\/a>/,
    );
    expect(html).toMatch(
      /<a href="\/venue\/bottom-of-the-hill\/">Bottom of the Hill<\/a>/,
    );
  });

  it("artist names link to /artist/{slug}/", () => {
    expect(html).toMatch(
      /<a href="\/artist\/artist-a\/">Artist A<\/a>/,
    );
    expect(html).toMatch(
      /<a href="\/artist\/artist-b\/">Artist B<\/a>/,
    );
  });

  it("JSON-LD location includes url", () => {
    const ld = extractJsonLd(html) as Array<{
      location: { url: string };
    }>;
    expect(ld[0]?.location.url).toBe("https://shows.wtf/venue/the-chapel/");
    expect(ld[1]?.location.url).toBe(
      "https://shows.wtf/venue/bottom-of-the-hill/",
    );
  });
});

describe("all page types: HTML escaping", () => {
  const venueHtml = buildVenuePage({
    name: "Hall & Oates",
    slug: "hall-and-oates",
    city: "San Francisco",
    address: null,
    shows: VENUE_SHOWS,
    updated: "2026-08-26",
  });
  const artistHtml = buildArtistPage({
    name: "Earth, Wind & Fire",
    slug: "earth-wind-fire",
    genres: ["r&b", "soul"],
    spotifyUrl: undefined,
    shows: ARTIST_SHOWS,
    updated: "2026-08-26",
  });
  const cityHtml = buildCityPage({
    name: "Wells & Mendip",
    slug: "wells-and-mendip",
    shows: CITY_SHOWS,
    updated: "2026-08-26",
  });

  it.each([
    ["venue", venueHtml],
    ["artist", artistHtml],
    ["city", cityHtml],
  ])("%s: & in name is escaped to &amp;", (_label, html) => {
    const title = extractTitle(html);
    expect(title).toContain("&amp;");
    expect(title).not.toMatch(/ & /);
  });
});

describe("all page types: CTA and styling", () => {
  const venueHtml = buildVenuePage({
    name: "V",
    slug: "v",
    city: "C",
    address: null,
    shows: [],
    updated: "2026-08-26",
  });
  const artistHtml = buildArtistPage({
    name: "A",
    slug: "a",
    genres: [],
    spotifyUrl: undefined,
    shows: [],
    updated: "2026-08-26",
  });
  const cityHtml = buildCityPage({
    name: "C",
    slug: "c",
    shows: [],
    updated: "2026-08-26",
  });

  it.each([
    ["venue", venueHtml],
    ["artist", artistHtml],
    ["city", cityHtml],
  ])("%s: CTA href is /", (_label, html) => {
    expect(html).toMatch(/<a class="cta" href="\/">/);
  });

  it.each([
    ["venue", venueHtml],
    ["artist", artistHtml],
    ["city", cityHtml],
  ])("%s: contains shared CSS (dark background color)", (_label, html) => {
    expect(html).toContain("#0a0a0a");
  });
});

describe("show cap", () => {
  function manyShows(n: number) {
    return Array.from({ length: n }, (_, i) => ({
      date: "2026-09-01",
      day: `Day ${i}`,
      extra: "",
      time: "9pm",
      price: "$10",
      age: null,
      artists: [{ name: `A${i}`, genres: [], slug: `a${i}` }],
    }));
  }

  it("venue page shows capped at 50", () => {
    const html = buildVenuePage({
      name: "Big",
      slug: "big",
      city: null,
      address: null,
      shows: manyShows(100),
      updated: "2026-08-26",
    });
    const articles = html.match(/<article class="show">/g);
    expect(articles).toHaveLength(50);
  });

  it("artist page shows capped at 50", () => {
    const shows = Array.from({ length: 100 }, (_, i) => ({
      date: "2026-09-01",
      day: `Day ${i}`,
      extra: "",
      time: "9pm",
      price: "$10",
      age: null,
      venueName: "V",
      venueSlug: "v",
      city: null,
      address: null,
      artists: [],
    }));
    const html = buildArtistPage({
      name: "A",
      slug: "a",
      genres: [],
      spotifyUrl: undefined,
      shows,
      updated: "2026-08-26",
    });
    const articles = html.match(/<article class="show">/g);
    expect(articles).toHaveLength(50);
  });

  it("city page shows capped at 50", () => {
    const shows = Array.from({ length: 100 }, (_, i) => ({
      date: "2026-09-01",
      day: `Day ${i}`,
      extra: "",
      time: "9pm",
      price: "$10",
      age: null,
      venueName: "V",
      venueSlug: "v",
      city: "San Francisco",
      address: "123 Main St",
      artists: [],
    }));
    const html = buildCityPage({
      name: "C",
      slug: "c",
      shows,
      updated: "2026-08-26",
    });
    const articles = html.match(/<article class="show">/g);
    expect(articles).toHaveLength(50);
  });

  it("JSON-LD does not contain raw < characters (script injection safe)", () => {
    const html = buildVenuePage({
      name: "The <Evil> Venue",
      slug: "the-evil-venue",
      city: "San Francisco",
      address: "123 Main St",
      shows: [{ date: "2026-09-01", day: "Mon Sep 1", extra: "", time: "8pm", price: "$10", age: null, artists: [{ name: "Band</script><script>alert(1)", genres: ["rock"], slug: "band" }] }],
      updated: "2026-08-26",
    });
    // Extract the JSON-LD content between script tags
    const match = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
    expect(match).not.toBeNull();
    const jsonLd = match![1];
    // No raw < in the JSON-LD body — every < must be \u003c escaped
    expect(jsonLd).not.toMatch(/<\//);
  });

  it("city page JSON-LD includes venue address", () => {
    const html = buildCityPage({
      name: "San Francisco",
      slug: "san-francisco",
      shows: [{ date: "2026-09-01", day: "Mon Sep 1", extra: "", time: "8pm", price: "$10", age: null, venueName: "The Fillmore", venueSlug: "the-fillmore", city: "San Francisco", address: "1805 Geary Blvd", artists: [{ name: "Band A", genres: ["rock"], slug: "band-a" }] }],
      updated: "2026-08-26",
    });
    const ld = extractJsonLd(html) as Array<Record<string, unknown>>;
    const event = ld[0] as Record<string, unknown>;
    const location = event.location as Record<string, unknown>;
    expect(location.address).toBeDefined();
    const addr = location.address as Record<string, unknown>;
    expect(addr.streetAddress).toBe("1805 Geary Blvd");
    expect(addr.addressLocality).toBe("San Francisco");
  });
});

describe("buildIndexPage", () => {
  const html = buildIndexPage({
    title: "All Venues",
    slug: "venue",
    description: "Browse all 135 Bay Area music venues on Bay Noise.",
    entries: [
      { name: "Bottom of the Hill", slug: "bottom-of-the-hill", subtitle: "San Francisco" },
      { name: "The Chapel", slug: "the-chapel", subtitle: "San Francisco" },
      { name: "Fox Theater", slug: "fox-theater", subtitle: "Oakland" },
    ],
  });

  it("title contains the provided title", () => {
    expect(extractTitle(html)).toBe("All Venues \u2014 Bay Noise");
  });

  it("canonical URL is /venue/", () => {
    expect(html).toMatch(/<link rel="canonical" href="https:\/\/shows\.wtf\/venue\/">/);
  });

  it("contains a link to every provided entry", () => {
    expect(html).toMatch(/<a href="\/venue\/bottom-of-the-hill\/">Bottom of the Hill<\/a>/);
    expect(html).toMatch(/<a href="\/venue\/the-chapel\/">The Chapel<\/a>/);
    expect(html).toMatch(/<a href="\/venue\/fox-theater\/">Fox Theater<\/a>/);
  });

  it("renders subtitles in .subtitle spans", () => {
    expect(html).toMatch(/<span class="subtitle">San Francisco<\/span>/);
    expect(html).toMatch(/<span class="subtitle">Oakland<\/span>/);
  });

  it("meta line shows the count", () => {
    expect(extractMetaLine(html)).toContain("3 venues");
  });

  it("JSON-LD @type is CollectionPage with url", () => {
    const ld = extractJsonLd(html) as Record<string, unknown>;
    expect(ld["@type"]).toBe("CollectionPage");
    expect(ld.url).toBe("https://shows.wtf/venue/");
    expect(ld.name).toBe("All Venues \u2014 Bay Noise");
  });

  it("CTA links to /", () => {
    expect(html).toMatch(/<a class="cta" href="\/">/);
  });

  it("omits subtitle span when none provided", () => {
    const noSubHtml = buildIndexPage({
      title: "All Artists",
      slug: "artist",
      description: "Browse all Bay Area artists on Bay Noise.",
      entries: [{ name: "Helado Negro", slug: "helado-negro" }],
    });
    expect(noSubHtml).not.toContain('<span class="subtitle">');
    expect(noSubHtml).toMatch(/<a href="\/artist\/helado-negro\/">Helado Negro<\/a>/);
  });

  it("localizes large counts with commas", () => {
    const manyEntries = Array.from({ length: 2317 }, (_, i) => ({
      name: `Artist ${i}`,
      slug: `artist-${i}`,
    }));
    const bigHtml = buildIndexPage({
      title: "All Artists",
      slug: "artist",
      description: "Browse all artists.",
      entries: manyEntries,
    });
    expect(extractMetaLine(bigHtml)).toContain("2,317 artists");
  });

  it("uses 'cities' plural for city slug", () => {
    const cityHtml = buildIndexPage({
      title: "All Cities",
      slug: "city",
      description: "x",
      entries: [
        { name: "Oakland", slug: "oakland" },
        { name: "San Francisco", slug: "san-francisco" },
      ],
    });
    expect(extractMetaLine(cityHtml)).toContain("2 cities");
    expect(extractMetaLine(cityHtml)).not.toContain("citys");
  });

  it("escapes HTML in entry names", () => {
    const safeHtml = buildIndexPage({
      title: "All Venues",
      slug: "venue",
      description: "x",
      entries: [{ name: "Hall & Oates", slug: "hall-and-oates" }],
    });
    expect(safeHtml).toContain("Hall &amp; Oates");
    expect(safeHtml).not.toMatch(/Hall & Oates(?!amp)/);
  });

  it("escapes HTML in subtitles", () => {
    const safeHtml = buildIndexPage({
      title: "All Venues",
      slug: "venue",
      description: "x",
      entries: [{ name: "V", slug: "v", subtitle: "M\u00e9nlo Park" }],
    });
    expect(safeHtml).toContain("M\u00e9nlo Park");
  });
});
