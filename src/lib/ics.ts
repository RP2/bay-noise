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
 * Pad a non-negative integer to two digits with a leading zero.
 */
function pad2(n: number): string {
  return n.toString().padStart(2, "0");
}

/**
 * Parse a show time string (e.g., "9pm", "9:30pm", "21:00", "7pm/8pm")
 * and combine it with a date to produce an ICS local datetime ("YYYYMMDDTHHMMSS").
 * Returns null when the string cannot be parsed as a single time.
 *
 * For complex times like "7pm/8pm" (doors/show), the second time is used.
 */
function parseIcsTime(time: string, date: string): string | null {
  validateDate(date);
  const datePart = date.replace(/-/g, "");

  // For "7pm/8pm" (doors + show), use the show time (the second value).
  const timeStr = time.includes("/") ? (time.split("/").pop() ?? "") : time;

  let hour: number;
  let minutes: number;

  const h12 = timeStr.match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)$/i);
  if (h12) {
    hour = parseInt(h12[1], 10);
    minutes = h12[2] ? parseInt(h12[2], 10) : 0;
    const meridiem = h12[3].toLowerCase();
    if (meridiem === "pm" && hour < 12) hour += 12;
    if (meridiem === "am" && hour === 12) hour = 0;
  } else {
    const h24 = timeStr.match(/^(\d{1,2}):(\d{2})$/);
    if (!h24) return null;
    hour = parseInt(h24[1], 10);
    minutes = parseInt(h24[2], 10);
  }

  if (hour < 0 || hour > 23 || minutes < 0 || minutes > 59) return null;

  return `${datePart}T${pad2(hour)}${pad2(minutes)}00`;
}

/**
 * Add an integer number of hours to an ICS local datetime ("YYYYMMDDTHHMMSS"),
 * returning a new ICS local datetime. The date may roll over to the next day.
 */
function addHours(icsDateTime: string, hours: number): string {
  const year = parseInt(icsDateTime.slice(0, 4), 10);
  const month = parseInt(icsDateTime.slice(4, 6), 10) - 1;
  const day = parseInt(icsDateTime.slice(6, 8), 10);
  const hh = parseInt(icsDateTime.slice(9, 11), 10);
  const mm = parseInt(icsDateTime.slice(11, 13), 10);
  const ss = parseInt(icsDateTime.slice(13, 15), 10);

  const d = new Date(year, month, day, hh, mm, ss);
  d.setHours(d.getHours() + hours);

  return (
    d.getFullYear().toString() +
    pad2(d.getMonth() + 1) +
    pad2(d.getDate()) +
    "T" +
    pad2(d.getHours()) +
    pad2(d.getMinutes()) +
    pad2(d.getSeconds())
  );
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
  const parts = [venue.name];
  if (venue.address) parts.push(venue.address);
  if (venue.city) parts.push(venue.city);
  return parts.join(", ");
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

  // Prefer a timed DTSTART when the venue has a parseable time; otherwise all-day.
  const start = venue.time ? parseIcsTime(venue.time, date) : null;
  const lines: string[] = ["BEGIN:VEVENT", `UID:${uid}`, `DTSTAMP:${dtstamp}`];

  if (start) {
    const startHour = parseInt(start.slice(9, 11), 10);
    const durationHours = startHour < 20 ? 3 : 2;
    const end = addHours(start, durationHours);
    lines.push(`DTSTART;TZID=America/Los_Angeles:${start}`);
    lines.push(`DTEND;TZID=America/Los_Angeles:${end}`);
  } else {
    lines.push(`DTSTART;VALUE=DATE:${dateValue}`);
  }

  lines.push(
    `SUMMARY:${escapeIcsText(summary)}`,
    `LOCATION:${escapeIcsText(location)}`,
  );

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
 * Each event uses a timed DTSTART when its venue has a parseable time
 * (with America/Los_Angeles TZID), and falls back to all-day otherwise.
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
