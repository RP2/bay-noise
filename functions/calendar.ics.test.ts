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
    const res = await onRequest({ request: makeRequest("?venues=bottom+of+the+hill") });
    const ics = await res.text();
    expect(countEvents(ics)).toBe(1);
    expect(ics).toContain("Bottom of the Hill");
  });

  it("filters by artist name (exact, case-insensitive)", async () => {
    const res = await onRequest({ request: makeRequest("?artists=sad+snack") });
    const ics = await res.text();
    expect(countEvents(ics)).toBe(1);
    expect(ics).toContain("Sad Snack");
  });

  it("filters by multiple venues (OR'd)", async () => {
    const res = await onRequest({ request: makeRequest("?venues=bottom&venues=gilman") });
    const ics = await res.text();
    expect(countEvents(ics)).toBe(2);
    expect(ics).toContain("Bottom of the Hill");
    expect(ics).toContain("924 Gilman Street");
  });

  it("filters by multiple artists (OR'd)", async () => {
    const res = await onRequest({ request: makeRequest("?artists=sad+snack&artists=cab") });
    const ics = await res.text();
    expect(countEvents(ics)).toBe(2);
    expect(ics).toContain("Sad Snack");
    expect(ics).toContain("Cab");
  });

  it("handles venue names containing commas", async () => {
    // "Bottom of the Hill, S.F." has a comma; repeated-key form avoids split issues
    const res = await onRequest({ request: makeRequest("?venues=Bottom+of+the+Hill%2C+S.F.") });
    const ics = await res.text();
    expect(countEvents(ics)).toBe(1);
    expect(ics).toContain("Bottom of the Hill");
    // Should NOT match "August Hall, S.F."
    expect(ics).not.toContain("August Hall");
  });

  it("filters by city exact match, case-insensitive", async () => {
    const res = await onRequest({ request: makeRequest("?cities=berkeley") });
    const ics = await res.text();
    expect(countEvents(ics)).toBe(1);
    expect(ics).toContain("924 Gilman Street");
    expect(ics).not.toContain("Bottom of the Hill");
  });

  it("filters by multiple cities (OR'd)", async () => {
    const res = await onRequest({ request: makeRequest("?cities=berkeley&cities=oakland") });
    const ics = await res.text();
    expect(countEvents(ics)).toBe(2);
    expect(ics).toContain("924 Gilman Street");
    expect(ics).toContain("The New Parish");
  });

  it("combines genre, venue, and artist filters with AND", async () => {
    // punk matches Bottom of the Hill (Sad Snack/Foolish Relics) and 924 Gilman
    // (Open Wound only; Spray's hardcore punk maps to hardcore, not punk). The
    // venue and artist params narrow it to Gilman + Open Wound.
    const res = await onRequest({ request: makeRequest("?preferred=punk&venues=gilman&artists=open+wound") });
    const ics = await res.text();
    expect(countEvents(ics)).toBe(1);
    expect(ics).toContain("Gilman");
    expect(ics).toContain("Open Wound");
  });

  it("venue + artist params together must both match", async () => {
    // Sad Snack plays Bottom of the Hill, not Gilman → empty feed
    const res = await onRequest({ request: makeRequest("?venues=gilman&artists=sad+snack") });
    const ics = await res.text();
    expect(countEvents(ics)).toBe(0);
    expect(ics).toContain("BEGIN:VCALENDAR");
  });

  it("returns an empty (valid) calendar when filters match nothing", async () => {
    const res = await onRequest({ request: makeRequest("?venues=nonexistent") });
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
