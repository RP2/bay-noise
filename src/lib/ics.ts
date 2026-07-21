import type { ShowDay, VenueEvent } from "./types.js";

const ENCODER = new TextEncoder();

/**
 * Compute a short, 8-character hex hash of a string using FNV-1a.
 */
function fnv1aHash(input: string): string {
  const bytes = ENCODER.encode(input);
  let hash = 0x811c9dc5;
  for (const byte of bytes) {
    hash ^= byte;
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * Escape text for ICS content lines.
 * Order matters: backslash first, then semicolon, comma, newlines.
 * Per RFC 5545 Section 3.3.11.
 */
function escapeIcsText(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");
}

/**
 * Validate that a date string matches YYYY-MM-DD format.
 */
function validateDate(date: string): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(
      `Invalid date format: "${date}". Expected YYYY-MM-DD.`,
    );
  }
}

/**
 * Compute the UTF-8 byte length of a string.
 */
function utf8ByteLength(str: string): number {
  return ENCODER.encode(str).length;
}

/**
 * Fold an ICS line so that each content line is at most 75 octets.
 * Continuation lines start with a single space (RFC 5545 Section 3.1).
 * The continuation space counts toward the 75-octet limit.
 * Uses UTF-8 byte length, not character count.
 */
function foldLine(line: string): string {
  const maxOctets = 75;
  const bytes = ENCODER.encode(line);
  if (bytes.length <= maxOctets) return line;

  const chars = Array.from(line);
  const parts: string[] = [];
  let bytePos = 0;
  let start = 0;

  for (let i = 0; i < chars.length; i++) {
    const charLen = utf8ByteLength(chars[i]);
    // Continuation lines have a 1-byte space prefix
    const budget = parts.length === 0 ? maxOctets : maxOctets - 1;

    if (bytePos + charLen > budget && i > start) {
      const segment = chars.slice(start, i).join("");
      parts.push(parts.length === 0 ? segment : " " + segment);
      bytePos = 0;
      start = i;
    }
    bytePos += charLen;
  }

  // Last segment
  const last = chars.slice(start).join("");
  parts.push(parts.length === 0 ? last : " " + last);

  return parts.join("\r\n");
}

/**
 * Format a date string (YYYY-MM-DD) into ICS all-day VALUE format.
 */
function formatDate(date: string): string {
  validateDate(date);
  return date.replace(/-/g, "");
}

/**
 * Convert an ISO date string (YYYY-MM-DD) to ICS UTC timestamp format (YYYYMMDDTHHMMSSZ).
 * Uses 00:00:00 as the time since the input is a date-only value.
 */
function toIcsUtc(dateStr: string): string {
  validateDate(dateStr);
  return `${dateStr.replace(/-/g, "")}T000000Z`;
}

/**
 * Build the SUMMARY line for a venue event.
 */
function buildSummary(venue: VenueEvent): string {
  const artistNames = venue.artists.map((a) => a.name).join(", ");
  return `${venue.name} — ${artistNames}`;
}

/**
 * Build the LOCATION line for a venue event, including city when available.
 */
function buildLocation(venue: VenueEvent): string {
  if (venue.city) {
    return `${venue.name}, ${venue.city}`;
  }
  return venue.name;
}

/**
 * Generate a single VEVENT component for a venue on a given date.
 * Returns an array of ICS lines (unfolded).
 */
function generateEvent(date: string, venue: VenueEvent, dtstamp: string): string[] {
  const dateValue = formatDate(date);
  let slug = venue.name
    .replace(/[^a-z0-9]/gi, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

  // Avoid collisions for short or empty slugs (e.g. "Bar" vs "Bar!")
  // by appending a hash of the original venue name.
  if (slug.length < 4) {
    slug = `${slug}-${fnv1aHash(venue.name)}`;
  }

  // Keep the UID from exceeding the fold limit before folding.
  slug = slug.slice(0, 60);

  const uid = `${dateValue}-${slug}-bay-noise`;
  const summary = buildSummary(venue);
  const location = buildLocation(venue);

  const lines: string[] = [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtstamp}`,
    `DTSTART;VALUE=DATE:${dateValue}`,
    `SUMMARY:${escapeIcsText(summary)}`,
    `LOCATION:${escapeIcsText(location)}`,
  ];

  if (venue.extra) {
    lines.push(`DESCRIPTION:${escapeIcsText(venue.extra)}`);
  }

  lines.push("END:VEVENT");
  return lines;
}

/**
 * Build the VCALENDAR header lines shared by all ICS documents.
 */
function buildHeader(): string[] {
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Bay Noise//shows.wtf//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Bay Noise",
    "X-WR-CALDESC:Bay Area show radar",
  ];
}

/**
 * Build an ICS document from top-level and per-event lines,
 * folding each line individually per RFC 5545.
 */
function buildIcs(lines: string[]): string {
  return lines.map(foldLine).join("\r\n") + "\r\n";
}

/**
 * Generate a complete .ics file content for a list of show days.
 * All events are all-day (no time parsing).
 *
 * @param shows - The show days to include
 * @param updated - ISO date string (YYYY-MM-DD) used as DTSTAMP for all events
 */
export function generateIcs(shows: ShowDay[], updated: string): string {
  const dtstamp = toIcsUtc(updated);

  const vevents = shows.flatMap((day) =>
    day.venues.flatMap((venue) => generateEvent(day.date, venue, dtstamp)),
  );

  return buildIcs([...buildHeader(), ...vevents, "END:VCALENDAR"]);
}

/**
 * Generate .ics content for a single venue event on a single date.
 * Used by the add-to-calendar component for per-event downloads.
 *
 * @param date - ISO date string (YYYY-MM-DD)
 * @param venue - The venue event to include
 * @param dtstamp - Optional ICS UTC timestamp. Defaults to current time.
 */
export function generateSingleIcs(
  date: string,
  venue: VenueEvent,
  dtstamp?: string,
): string {
  const stamp =
    dtstamp ??
    new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");

  const vevent = generateEvent(date, venue, stamp);

  return buildIcs([...buildHeader(), ...vevent, "END:VCALENDAR"]);
}
