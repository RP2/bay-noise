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
    expect(result).toMatch(/\r\nEND:VCALENDAR$/);
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

  it("uses all-day DTSTART format (VALUE=DATE)", () => {
    const result = generateIcs([minimalShow], UPDATED);
    expect(result).toContain("DTSTART;VALUE=DATE:20260725");
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
          artists: [{ name: "Band 1", genres: ["punk"] }],
          extra: "9pm",
          time: "9pm",
          price: null,
          age: null,
        },
        {
          name: "Venue B",
          city: "Oakland",
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
    expect(result).toMatch(/\r\nEND:VCALENDAR$/);
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

  it("uses the correct date for DTSTART", () => {
    const result = generateSingleIcs("2026-07-25", venue, "20260720T000000Z");
    expect(result).toContain("DTSTART;VALUE=DATE:20260725");
  });

  it("includes both artist names in SUMMARY", () => {
    const result = generateSingleIcs("2026-07-25", venue, "20260720T000000Z");
    expect(result).toContain("Sad Snack");
    expect(result).toContain("Foolish Relics");
  });

  it("returns valid VCALENDAR bookends", () => {
    const result = generateSingleIcs("2026-07-25", venue, "20260720T000000Z");
    expect(result).toMatch(/^BEGIN:VCALENDAR\r\n/);
    expect(result).toMatch(/\r\nEND:VCALENDAR$/);
  });

  it("uses provided DTSTAMP when given", () => {
    const result = generateSingleIcs("2026-07-25", venue, "20260720T000000Z");
    expect(result).toContain("DTSTAMP:20260720T000000Z");
  });
});
