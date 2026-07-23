// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/preact";
import { App } from "./app.js";
import { SAMPLE_SHOWS } from "./lib/__fixtures__/shows.js";

afterEach(cleanup);

const TEST_GENRES = ["punk", "pop punk", "indie rock", "metal", "hip hop", "rap"];

/** Mock fetch that returns appropriate data based on URL path. */
function mockFetch(
  shows = SAMPLE_SHOWS,
  genres = TEST_GENRES,
  fail = false,
) {
  vi.stubGlobal(
    "fetch",
    vi.fn((url: string) => {
      if (fail && url.includes("shows.json")) {
        return Promise.reject(new Error("Network error"));
      }
      if (url.includes("available-genres.json")) {
        return Promise.resolve(
          new Response(JSON.stringify(genres), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify(shows), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }),
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe("App", () => {
  it("shows greeter when not onboarded", () => {
    const { getByText } = render(<App />);
    expect(getByText("See everything")).toBeDefined();
  });

  it("transitions from greeter to loading to feed after onboarding", async () => {
    mockFetch();

    const { getByText, findByPlaceholderText } = render(<App />);
    expect(getByText("See everything")).toBeDefined();

    fireEvent.click(getByText("Show me what's on"));
    expect(getByText("Loading shows...")).toBeDefined();

    await findByPlaceholderText("Search artists, venues...");
  });

  it("shows error when fetch fails", async () => {
    mockFetch(SAMPLE_SHOWS, TEST_GENRES, true);

    const { getByText, findByText } = render(<App />);
    fireEvent.click(getByText("Show me what's on"));

    await findByText("Failed to load shows.");
    expect(getByText("Network error")).toBeDefined();
    expect(getByText("Try again")).toBeDefined();
  });

  it("retries after error when 'Try again' is clicked", async () => {
    let showsCalls = 0;
    const fetchMock = vi.fn((url: string) => {
      if (url.includes("available-genres.json")) {
        return Promise.resolve(
          new Response(JSON.stringify(TEST_GENRES), {
            status: 200, headers: { "Content-Type": "application/json" },
          }),
        );
      }
      if (url.includes("shows.json")) {
        showsCalls++;
        if (showsCalls === 1) {
          return Promise.reject(new Error("Network error"));
        }
        return Promise.resolve(
          new Response(JSON.stringify(SAMPLE_SHOWS), {
            status: 200, headers: { "Content-Type": "application/json" },
          }),
        );
      }
      return Promise.reject(new Error("Unknown URL"));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { getByText, findByText, findByPlaceholderText } = render(<App />);
    fireEvent.click(getByText("Show me what's on"));

    await findByText("Failed to load shows.");
    fireEvent.click(getByText("Try again"));

    await findByPlaceholderText("Search artists, venues...");
    expect(showsCalls).toBe(2);
  });

  it("shows all shows when no genres selected (HD 17)", async () => {
    mockFetch();

    const { getByText, findByText } = render(<App />);
    fireEvent.click(getByText("Show me what's on"));

    await findByText(/5 shows/);
    expect(getByText(/\(all\)/)).toBeDefined();
  });

  it("change genres button resets to greeter", async () => {
    mockFetch();

    const { getByText, findByPlaceholderText } = render(<App />);
    fireEvent.click(getByText("Show me what's on"));
    await findByPlaceholderText("Search artists, venues...");

    fireEvent.click(getByText("Reopen greeter"));
    expect(getByText("See everything")).toBeDefined();
  });
});

describe("Search UX", () => {
  it("typing a genre name never auto-converts to a chip", async () => {
    mockFetch();
    const { getByText, findByPlaceholderText } = render(<App />);
    fireEvent.click(getByText("Show me what's on"));
    const input = await findByPlaceholderText("Search artists, venues...") as HTMLInputElement;

    // Type "punk" — should remain as text, not auto-convert
    fireEvent.input(input, { target: { value: "punk" } });
    expect(input.value).toBe("punk"); // still in search box, no chip
  });
});
