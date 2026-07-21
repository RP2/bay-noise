/**
 * Cloudflare Pages Function — iCal feed subscription endpoint.
 * Serves the full calendar at GET /calendar.ics.
 * Reads the static shows.json and generates ICS using the shared lib.
 */
import { generateIcs } from "../src/lib/ics.js";
import type { ShowsData } from "../src/lib/types.js";

export async function onRequest(context: { request: Request }): Promise<Response> {
  if (context.request.method !== "GET") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  try {
    const url = new URL(context.request.url);

    // Fetch the static shows.json deployed alongside the function.
    // Pages Functions have access to the static assets at the same origin.
    const resp = await fetch(new URL("/shows.json", url).toString());
    if (!resp.ok) {
      console.error(`shows.json fetch failed: HTTP ${resp.status}`);
      return new Response("Calendar temporarily unavailable.", { status: 502 });
    }

    let data: ShowsData;
    try {
      data = (await resp.json()) as ShowsData;
    } catch {
      console.error("shows.json parse failed — likely a partial pipeline write");
      return new Response("Calendar temporarily unavailable.", { status: 502 });
    }

    if (!Array.isArray(data.shows)) {
      console.error("shows.json missing shows array");
      return new Response("Calendar temporarily unavailable.", { status: 502 });
    }

    const ics = generateIcs(data.shows, data.updated || new Date().toISOString().slice(0, 10));

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
