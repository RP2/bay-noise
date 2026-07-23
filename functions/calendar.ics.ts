/**
 * Cloudflare Pages Function — iCal feed subscription endpoint.
 * Query params (all optional, combined with AND):
 *   ?preferred=genre1,genre2  — filter by genre strings (comma-separated, exact match only)
 *   ?venue=bottom+of+the+hill — filter by venue name (substring, case-insensitive)
 *   ?artist=sad+snack         — filter by artist name (substring, case-insensitive)
 * Defaults to all shows when no params are given (backwards compatible).
 * Genre matching uses scoreArtistGenres from filter.ts for front-end consistency.
 */
import { generateIcs } from "../src/lib/ics.js";
import { scoreArtistGenres } from "../src/lib/filter.js";
import type { ShowsData, ShowDay } from "../src/lib/types.js";

function todayLocal(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function onRequest(context: { request: Request }): Promise<Response> {
  if (context.request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const url = new URL(context.request.url);
    const raw = url.searchParams.get("preferred") || "";
    const preferred = raw
      .toLowerCase()
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const venueParam = (url.searchParams.get("venue") || "").toLowerCase().trim();
    const artistParam = (url.searchParams.get("artist") || "").toLowerCase().trim();

    const resp = await fetch(new URL("/shows.json", url).toString());
    if (!resp.ok) {
      console.error(`shows.json fetch failed: HTTP ${resp.status}`);
      return new Response("Calendar temporarily unavailable.", { status: 502 });
    }

    let data: ShowsData;
    try {
      data = (await resp.json()) as ShowsData;
    } catch {
      console.error("shows.json parse failed");
      return new Response("Calendar temporarily unavailable.", { status: 502 });
    }

    if (!Array.isArray(data.shows)) {
      console.error("shows.json missing shows array");
      return new Response("Calendar temporarily unavailable.", { status: 502 });
    }

    const cutoff = todayLocal();

    const shows: ShowDay[] = data.shows
      .filter((day) => day.date >= cutoff)
      .map((day) => ({
        ...day,
        venues: day.venues.filter((venue) =>
          (!venueParam || venue.name.toLowerCase().includes(venueParam)) &&
          (!artistParam || venue.artists.some((a) => a.name.toLowerCase().includes(artistParam))) &&
          (preferred.length === 0 ||
            venue.artists.some((artist) =>
              scoreArtistGenres(artist.genres, preferred) > 0,
            ))
        ),
      }))
      .filter((day) => day.venues.length > 0);

    const ics = generateIcs(shows, data.updated || new Date().toISOString().slice(0, 10));

    return new Response(ics, {
      headers: {
        "Content-Type": "text/calendar; charset=utf-8; method=PUBLISH",
        "Content-Disposition": `inline; filename="bay-noise.ics"`,
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
      },
    });
  } catch (err) {
    console.error("calendar.ics error:", err);
    return new Response("Calendar temporarily unavailable.", { status: 500 });
  }
}
