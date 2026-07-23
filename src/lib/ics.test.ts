import { describe, it, expect } from "vitest";
import { generateIcs, generateSingleIcs } from "./ics.js";
import { SAMPLE_SHOWS } from "./__fixtures__/shows.js";
import type { ShowDay, VenueEvent } from "./types.js";

/** UTF-8 byte length of a string */
function utf8Len(s: string): number {
  return new TextEncoder().encode(s).length;
}

describe("generateIcs", () => {
  const UPDATED = "2026-07-20";
  const minimalShow: ShowDay = SAMPLE_SHOWS.shows[0];

  it("starts with VCALENDAR and ends with VCALENDAR", () => {
    const result = generateIcs([minimalShow], UPDATED);
    expect(result).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(result).toMatch(/\r\nEND:VCALENDAR\r\n$/);
  });

  it("includes VERSION:2.0", () => {
    const result = generateIcs([minimalShow], UPDATED);
    expect(result).toContain("VERSION:2.0");
  });

  it("includes PRODID", () => {
    const result = generateIcs([minimalShow], UPDATED);
    expect(result).toContain("PRODID:-//Bay Noise//shows.wtf//EN");
  });

  it("includes CALSCALE:GREGORIAN and METHOD:PUBLISH", () => {
    const result = generateIcs([minimalShow], UPDATED);
    expect(result).toContain("CALSCALE:GREGORIAN");
    expect(result).toContain("METHOD:PUBLISH");
  });

  it("generates a VEVENT for each venue", () => {
    const result = generateIcs([minimalShow], UPDATED);
    expect(result).toContain("BEGIN:VEVENT");
    expect(result).toContain("END:VEVENT");
  });

  it("uses timed DTSTART with TZID when venue has a parseable time", () => {
    const result = generateIcs([minimalShow], UPDATED);
    // Bottom of the Hill: time "9pm" → 21:00, 2h duration
    expect(result).toContain("DTSTART;TZID=America/Los_Angeles:20260725T210000");
    expect(result).toContain("DTEND;TZID=America/Los_Angeles:20260725T230000");
  });

  it("includes venue name in SUMMARY (ICS-escaped)", () => {
    const result = generateIcs([minimalShow], UPDATED);
    expect(result).toContain("Bottom of the Hill\\, S.F.");
  });

  it("includes artist names in SUMMARY", () => {
    const result = generateIcs([minimalShow], UPDATED);
    expect(result).toContain("Sad Snack");
  });

  it("includes LOCATION with city", () => {
    const result = generateIcs([minimalShow], UPDATED);
    expect(result).toContain("LOCATION:Bottom of the Hill\\, S.F.\\, San Francisco");
  });

  it("includes DESCRIPTION for venues with extra", () => {
    const result = generateIcs([minimalShow], UPDATED);
    // The middle dot (·) does not need ICS escaping — only \, ; , \n are escaped
    expect(result).toContain("DESCRIPTION:9pm · $15");
  });

  it("omits DESCRIPTION when extra is empty", () => {
    const noExtraShow: ShowDay = {
      date: "2026-07-25",
      day: "Sat Jul 25",
      venues: [
        {
          name: "The Venue",
          city: "San Francisco",
          address: null,
          artists: [{ name: "A Band", genres: ["rock"] }],
          extra: "",
          time: null,
          price: null,
          age: null,
        },
      ],
    };
    const result = generateIcs([noExtraShow], UPDATED);
    expect(result).not.toContain("DESCRIPTION:");
  });

  it("uses DTSTAMP derived from updated timestamp", () => {
    const result = generateIcs([minimalShow], UPDATED);
    expect(result).toContain("DTSTAMP:20260720T000000Z");
  });

  it("generates multiple VEVENTs for multiple venues on one day", () => {
    const multiVenueDay: ShowDay = {
      date: "2026-07-25",
      day: "Sat Jul 25",
      venues: [
        {
          name: "Venue A",
          city: "San Francisco",
          address: null,
          artists: [{ name: "Band 1", genres: ["punk"] }],
          extra: "9pm",
          time: "9pm",
          price: null,
          age: null,
        },
        {
          name: "Venue B",
          city: "Oakland",
          address: null,
          artists: [{ name: "Band 2", genres: ["indie"] }],
          extra: "8pm",
          time: "8pm",
          price: null,
          age: null,
        },
      ],
    };
    const result = generateIcs([multiVenueDay], UPDATED);
    const veventCount = (result.match(/BEGIN:VEVENT/g) || []).length;
    expect(veventCount).toBe(2);
  });

  it("generates multiple VEVENTs for multiple days", () => {
    const result = generateIcs(SAMPLE_SHOWS.shows, UPDATED);
    const veventCount = (result.match(/BEGIN:VEVENT/g) || []).length;
    // SAMPLE_SHOWS has 5 venues across 4 days
    expect(veventCount).toBe(5);
  });

  it("escapes special characters in text fields", () => {
    const specialShow: ShowDay = {
      date: "2026-08-01",
      day: "Sat Aug 1",
      venues: [
        {
          name: "Venue; Name, Co.",
          city: "SF",
          address: null,
          artists: [{ name: "Band \\ A", genres: ["punk"] }],
          extra: "Doors 8pm; $10 (cash)",
          time: "8pm",
          price: "$10",
          age: null,
        },
      ],
    };
    const result = generateIcs([specialShow], UPDATED);
    expect(result).toContain("Venue\\; Name\\, Co.");
    expect(result).toContain("Band \\\\ A");
    expect(result).toContain("Doors 8pm\\; $10 (cash)");
  });

  it("escapes backslash before comma and semicolon (escape order)", () => {
    // Input artist name has: Foo + \ + , + ; + Bar
    // escapeIcsText order must be: backslash first, then semicolon, then comma.
    // Result: Foo + \\ (escaped backslash) + \, (escaped comma) + \; (escaped semicolon) + Bar
    const escapeOrderShow: ShowDay = {
      date: "2026-08-01",
      day: "Sat Aug 1",
      venues: [
        {
          name: "Test Venue",
          city: "SF",
          address: null,
          artists: [{ name: "Foo\\,;Bar", genres: ["punk"] }],
          extra: "",
          time: null,
          price: null,
          age: null,
        },
      ],
    };
    const result = generateIcs([escapeOrderShow], UPDATED);
    // Build the expected escaped string: Foo + \\ + \, + \; + Bar
    // Use concat to avoid JS string literal confusion
    const escapedBackslash = "\\" + "\\"; // two backslashes in string
    const escapedComma = "\\" + ","; // backslash + comma in string
    const escapedSemicolon = "\\" + ";"; // backslash + semicolon in string
    const expectedArtistName = "Foo" + escapedBackslash + escapedComma + escapedSemicolon + "Bar";
    expect(result).toContain(expectedArtistName);
  });

  it("escapes newlines in text fields", () => {
    const newlineShow: ShowDay = {
      date: "2026-08-01",
      day: "Sat Aug 1",
      venues: [
        {
          name: "Venue",
          city: "SF",
          address: null,
          artists: [{ name: "Band", genres: ["punk"] }],
          extra: "line1\nline2",
          time: null,
          price: null,
          age: null,
        },
      ],
    };
    const result = generateIcs([newlineShow], UPDATED);
    expect(result).toContain("line1\\nline2");
    // No raw newline inside a content line
    const contentLines = result.split("\r\n").filter((l) => !l.startsWith(" "));
    expect(contentLines.some((l) => l.includes("DESCRIPTION:"))).toBe(true);
  });

  it("generates a stable UID across calls", () => {
    const result1 = generateIcs([minimalShow], UPDATED);
    const result2 = generateIcs([minimalShow], UPDATED);
    // Strip DTSTAMP (always same with same updated) and compare UID
    const uidRegex = /UID:([^\r\n]+)/;
    const uid1 = result1.match(uidRegex)?.[1];
    const uid2 = result2.match(uidRegex)?.[1];
    expect(uid1).toBe(uid2);
  });

  it("returns a valid empty VCALENDAR for empty shows", () => {
    const result = generateIcs([], UPDATED);
    expect(result).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(result).toMatch(/\r\nEND:VCALENDAR\r\n$/);
    expect(result).not.toContain("BEGIN:VEVENT");
    expect(result).toContain("VERSION:2.0");
    expect(result).toContain("PRODID:-//Bay Noise//shows.wtf//EN");
  });

  it("no content line exceeds 75 octets", () => {
    const longNameShow: ShowDay = {
      date: "2026-07-25",
      day: "Sat Jul 25",
      venues: [
        {
          name: "A Very Long Venue Name That Goes On And On And On And On And On And On And On",
          city: "San Francisco",
          address: null,
          artists: [
            {
              name: "An Even Longer Band Name That Definitely Exceeds Seventy Five Characters In Total",
              genres: ["punk"],
            },
          ],
          extra: "this is a very long extra description that should also get folded across multiple lines for sure yes indeed",
          time: null,
          price: null,
          age: null,
        },
      ],
    };
    const result = generateIcs([longNameShow], UPDATED);
    const lines = result.split("\r\n");
    const tooLong = lines.filter(
      (l) => utf8Len(l) > 75 && !l.startsWith(" "),
    );
    expect(tooLong).toHaveLength(0);
  });

  it("folds lines containing multi-byte characters correctly", () => {
    const multiByteShow: ShowDay = {
      date: "2026-07-25",
      day: "Sat Jul 25",
      venues: [
        {
          name: "Café avec un nom très long — et avec des caractères spéciaux",
          city: "San Francisco",
          address: null,
          artists: [
            {
              name: "Artiste avec un nom très long également — ça dépasse 75 octets facilement",
              genres: ["punk"],
            },
          ],
          extra: "9pm · $15 · avec des caractères spéciaux comme éèêëàâäùûüôöîïç",
          time: null,
          price: null,
          age: null,
        },
      ],
    };
    const result = generateIcs([multiByteShow], UPDATED);
    const lines = result.split("\r\n");

    // Each line (including continuation) must not exceed 75 octets
    const tooLong = lines.filter(
      (l) => utf8Len(l) > 75 && !l.startsWith(" "),
    );
    expect(tooLong).toHaveLength(0);

    // Continuation lines must start with space
    const contLines = lines.filter((l) => l.startsWith(" "));
    for (const cl of contLines) {
      expect(utf8Len(cl)).toBeLessThanOrEqual(75);
    }
  });
});

describe("generateSingleIcs", () => {
  const venue: VenueEvent = {
    name: "Bottom of the Hill, S.F.",
    city: "San Francisco",
    address: null,
    artists: [
      { name: "Sad Snack", genres: ["punk"] },
      { name: "Foolish Relics", genres: ["punk"] },
    ],
    extra: "9pm · $15",
    time: "9pm",
    price: "$15",
    age: null,
  };

  it("includes X-WR-CALNAME", () => {
    const result = generateSingleIcs("2026-07-25", venue, "20260720T000000Z");
    expect(result).toContain("X-WR-CALNAME:Bay Noise");
  });

  it("contains exactly one VEVENT", () => {
    const result = generateSingleIcs("2026-07-25", venue, "20260720T000000Z");
    const veventCount = (result.match(/BEGIN:VEVENT/g) || []).length;
    expect(veventCount).toBe(1);
  });

  it("uses the correct date and time for DTSTART when venue has time", () => {
    const result = generateSingleIcs("2026-07-25", venue, "20260720T000000Z");
    // venue.time = "9pm" → 21:00 in America/Los_Angeles, 2h duration
    expect(result).toContain("DTSTART;TZID=America/Los_Angeles:20260725T210000");
    expect(result).toContain("DTEND;TZID=America/Los_Angeles:20260725T230000");
  });

  it("includes both artist names in SUMMARY", () => {
    const result = generateSingleIcs("2026-07-25", venue, "20260720T000000Z");
    expect(result).toContain("Sad Snack");
    expect(result).toContain("Foolish Relics");
  });

  it("returns valid VCALENDAR bookends", () => {
    const result = generateSingleIcs("2026-07-25", venue, "20260720T000000Z");
    expect(result).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(result).toMatch(/\r\nEND:VCALENDAR\r\n$/);
  });

  it("uses provided DTSTAMP when given", () => {
    const result = generateSingleIcs("2026-07-25", venue, "20260720T000000Z");
    expect(result).toContain("DTSTAMP:20260720T000000Z");
  });
});

describe("time parsing", () => {
  const baseVenue: VenueEvent = {
    name: "The Venue",
    city: "San Francisco",
    address: null,
    artists: [{ name: "Band", genres: ["rock"] }],
    extra: "",
    time: "9pm",
    price: null,
    age: null,
  };

  function makeIcs(time: string | null): string {
    return generateSingleIcs(
      "2026-07-25",
      { ...baseVenue, time },
      "20260720T000000Z",
    );
  }

  it("parses 9pm as 21:00 with 2h duration", () => {
    const result = makeIcs("9pm");
    expect(result).toContain("DTSTART;TZID=America/Los_Angeles:20260725T210000");
    expect(result).toContain("DTEND;TZID=America/Los_Angeles:20260725T230000");
  });

  it("parses 9:00pm as 21:00", () => {
    expect(makeIcs("9:00pm")).toContain("DTSTART;TZID=America/Los_Angeles:20260725T210000");
  });

  it("parses 9:30pm as 21:30", () => {
    expect(makeIcs("9:30pm")).toContain("DTSTART;TZID=America/Los_Angeles:20260725T213000");
  });

  it("parses 9am as 09:00", () => {
    expect(makeIcs("9am")).toContain("DTSTART;TZID=America/Los_Angeles:20260725T090000");
  });

  it("parses 21:00 (24h) as 21:00", () => {
    expect(makeIcs("21:00")).toContain("DTSTART;TZID=America/Los_Angeles:20260725T210000");
  });

  it("uses the second time for complex '7pm/8pm' doors/show format", () => {
    // 8pm = 20:00, ≥ 20 → 2h duration
    const result = makeIcs("7pm/8pm");
    expect(result).toContain("DTSTART;TZID=America/Los_Angeles:20260725T200000");
    expect(result).toContain("DTEND;TZID=America/Los_Angeles:20260725T220000");
  });

  it("uses 3h duration for shows starting before 8pm", () => {
    // 7:30pm = 19:30, < 20 → 3h duration
    const result = makeIcs("7:30pm");
    expect(result).toContain("DTSTART;TZID=America/Los_Angeles:20260725T193000");
    expect(result).toContain("DTEND;TZID=America/Los_Angeles:20260725T223000");
  });

  it("uses 2h duration for shows starting at 8pm exactly", () => {
    const result = makeIcs("8pm");
    expect(result).toContain("DTSTART;TZID=America/Los_Angeles:20260725T200000");
    expect(result).toContain("DTEND;TZID=America/Los_Angeles:20260725T220000");
  });

  it("uses 2h duration for late shows and rolls DTEND to the next day", () => {
    // 10pm + 2h = midnight
    const result = makeIcs("10pm");
    expect(result).toContain("DTSTART;TZID=America/Los_Angeles:20260725T220000");
    expect(result).toContain("DTEND;TZID=America/Los_Angeles:20260726T000000");
  });

  it("falls back to all-day when time is null", () => {
    const result = makeIcs(null);
    expect(result).toContain("DTSTART;VALUE=DATE:20260725");
    expect(result).not.toContain("DTSTART;TZID");
    expect(result).not.toContain("DTEND");
  });

  it("falls back to all-day when time is an empty string", () => {
    const result = makeIcs("");
    expect(result).toContain("DTSTART;VALUE=DATE:20260725");
    expect(result).not.toContain("DTSTART;TZID");
  });

  it("falls back to all-day when time is unparseable", () => {
    const result = makeIcs("TBA");
    expect(result).toContain("DTSTART;VALUE=DATE:20260725");
    expect(result).not.toContain("DTSTART;TZID");
  });

  it("falls back to all-day for a bare hour without meridiem", () => {
    // "9" alone is ambiguous (9am vs 9pm); require explicit am/pm or 24h colon form.
    const result = makeIcs("9");
    expect(result).toContain("DTSTART;VALUE=DATE:20260725");
  });

  it("uses TZID=America/Los_Angeles for timed events", () => {
    expect(makeIcs("9pm")).toContain("DTSTART;TZID=America/Los_Angeles:");
  });
});

describe("generateIcs with mixed timed and all-day events", () => {
  it("emits DTSTART;VALUE=DATE for null-time venues and DTSTART;TZID for timed venues", () => {
    const mixedDay: ShowDay = {
      date: "2026-07-25",
      day: "Sat Jul 25",
      venues: [
        {
          name: "Timed Venue",
          city: "San Francisco",
          address: null,
          artists: [{ name: "Band A", genres: ["rock"] }],
          extra: "9pm",
          time: "9pm",
          price: null,
          age: null,
        },
        {
          name: "All Day Venue",
          city: "Oakland",
          address: null,
          artists: [{ name: "Band B", genres: ["rock"] }],
          extra: "",
          time: null,
          price: null,
          age: null,
        },
      ],
    };
    const result = generateIcs([mixedDay], "2026-07-20");
    expect(result).toContain("DTSTART;TZID=America/Los_Angeles:20260725T210000");
    expect(result).toContain("DTSTART;VALUE=DATE:20260725");
  });
});
