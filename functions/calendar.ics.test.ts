import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { onRequest } from "./calendar.ics.js";
import { SAMPLE_SHOWS } from "../src/lib/__fixtures__/shows.js";

function makeRequest(query = ""): Request {
  return new Request(`https://bay-noise.pages.dev/calendar.ics${query}`);
}

function stubShowsFetch() {
  vi.stubGlobal("fetch", vi.fn(() =>
    Promise.resolve(new Response(JSON.stringify(SAMPLE_SHOWS), {
      status: 200, headers: { "Content-Type": "application/json" },
    })),
  ));
}

function countEvents(ics: string): number {
  return ics.split("BEGIN:VEVENT").length - 1;
}

describe("calendar.ics onRequest", () => {
  beforeEach(() => {
    // Pin "today" before the fixture dates (2026-07-25 … 2026-08-15)
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-20T12:00:00"));
    stubShowsFetch();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("returns all upcoming shows with no params (backwards compatible)", async () => {
    const res = await onRequest({ request: makeRequest() });
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toContain("text/calendar");
    const ics = await res.text();
    expect(countEvents(ics)).toBe(5);
  });

  it("filters by venue name substring, case-insensitive", async () => {
    const res = await onRequest({ request: makeRequest("?venue=bottom+of+the+hill") });
    const ics = await res.text();
    expect(countEvents(ics)).toBe(1);
    expect(ics).toContain("Bottom of the Hill");
  });

  it("filters by artist name substring, case-insensitive", async () => {
    const res = await onRequest({ request: makeRequest("?artist=sad+snack") });
    const ics = await res.text();
    expect(countEvents(ics)).toBe(1);
    expect(ics).toContain("Sad Snack");
  });

  it("combines genre, venue, and artist filters with AND", async () => {
    // punk matches both Bottom of the Hill and 924 Gilman; the venue
    // param narrows it to Gilman only.
    const res = await onRequest({ request: makeRequest("?preferred=punk&venue=gilman") });
    const ics = await res.text();
    expect(countEvents(ics)).toBe(1);
    expect(ics).toContain("Gilman");
  });

  it("venue + artist params together must both match", async () => {
    // Sad Snack plays Bottom of the Hill, not Gilman → empty feed
    const res = await onRequest({ request: makeRequest("?venue=gilman&artist=sad+snack") });
    const ics = await res.text();
    expect(countEvents(ics)).toBe(0);
    expect(ics).toContain("BEGIN:VCALENDAR");
  });

  it("returns an empty (valid) calendar when filters match nothing", async () => {
    const res = await onRequest({ request: makeRequest("?venue=nonexistent") });
    expect(res.status).toBe(200);
    const ics = await res.text();
    expect(countEvents(ics)).toBe(0);
    expect(ics).toMatch(/^BEGIN:VCALENDAR\r\n/);
  });

  it("excludes past dates", async () => {
    vi.setSystemTime(new Date("2026-08-02T12:00:00"));
    const res = await onRequest({ request: makeRequest() });
    const ics = await res.text();
    // Only the 2026-08-15 show remains
    expect(countEvents(ics)).toBe(1);
    expect(ics).toContain("The Temple");
  });

  it("rejects non-GET methods", async () => {
    const res = await onRequest({
      request: new Request("https://bay-noise.pages.dev/calendar.ics", { method: "POST" }),
    });
    expect(res.status).toBe(405);
  });
});
