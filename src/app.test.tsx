// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/preact";
import { App } from "./app.js";
import { SAMPLE_SHOWS } from "./lib/__fixtures__/shows.js";

afterEach(cleanup);

beforeEach(() => {
  localStorage.clear();
});

describe("App", () => {
  it("shows greeter when not onboarded", () => {
    const { getByText } = render(<App />);
    expect(getByText("Pick your genres. We'll find your shows.")).toBeDefined();
  });

  it("transitions from greeter to loading to feed after onboarding", async () => {
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify(SAMPLE_SHOWS), {
        status: 200, headers: { "Content-Type": "application/json" },
      })),
    ));

    const { getByText, findByPlaceholderText } = render(<App />);
    expect(getByText("Pick your genres. We'll find your shows.")).toBeDefined();

    fireEvent.click(getByText("Show me what's on"));
    expect(getByText("Loading shows...")).toBeDefined();

    await findByPlaceholderText("Search artists, venues...");
  });

  it("shows error when fetch fails", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("Network error"))));

    const { getByText, findByText } = render(<App />);
    fireEvent.click(getByText("Show me what's on"));

    await findByText("Failed to load shows.");
    expect(getByText("Network error")).toBeDefined();
    expect(getByText("Try again")).toBeDefined();
  });

  it("retries after error when 'Try again' is clicked", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce(new Response(JSON.stringify(SAMPLE_SHOWS), {
        status: 200, headers: { "Content-Type": "application/json" },
      }));
    vi.stubGlobal("fetch", fetchMock);

    const { getByText, findByText, findByPlaceholderText } = render(<App />);
    fireEvent.click(getByText("Show me what's on"));

    await findByText("Failed to load shows.");
    fireEvent.click(getByText("Try again"));

    await findByPlaceholderText("Search artists, venues...");
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("shows all shows when no genres selected (HD 17)", async () => {
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify(SAMPLE_SHOWS), {
        status: 200, headers: { "Content-Type": "application/json" },
      })),
    ));

    const { getByText, findByText } = render(<App />);
    fireEvent.click(getByText("Show me what's on"));

    await findByText(/5 shows/);
    expect(getByText(/\(all\)/)).toBeDefined();
  });

  it("change genres button resets to greeter", async () => {
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify(SAMPLE_SHOWS), {
        status: 200, headers: { "Content-Type": "application/json" },
      })),
    ));

    const { getByText, findByPlaceholderText } = render(<App />);

    fireEvent.click(getByText("Show me what's on"));
    await findByPlaceholderText("Search artists, venues...");

    fireEvent.click(getByText("Reopen greeter"));
    expect(getByText("Pick your genres. We'll find your shows.")).toBeDefined();
  });
});

describe("Search UX", () => {
  async function onboard() {
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify(SAMPLE_SHOWS), {
        status: 200, headers: { "Content-Type": "application/json" },
      })),
    ));
    const utils = render(<App />);
    fireEvent.click(utils.getByText("Show me what's on"));
    const input = (await utils.findByPlaceholderText("Search artists, venues...")) as HTMLInputElement;
    return { ...utils, input };
  }

  it("typing a genre name never auto-converts to a chip", async () => {
    const { input, queryByLabelText } = await onboard();
    fireEvent.input(input, { target: { value: "metal" } });
    // Text stays in the box and no genre chip is created mid-typing,
    // so the user can continue to "metalcore".
    expect(input.value).toBe("metal");
    expect(queryByLabelText("Remove metal filter")).toBeNull();
    expect(JSON.parse(localStorage.getItem("bay-noise-prefs")!).preferredGenres).toEqual([]);
  });

  it("Enter on a sub-genre adds that genre string chip and clears search", async () => {
    const { input, getByLabelText } = await onboard();
    fireEvent.input(input, { target: { value: "indie rock" } });
    fireEvent.keyDown(input, { key: "Enter" });
    // "indie rock" is now stored as its own filter, not mapped to "indie"
    expect(getByLabelText("Remove indie rock filter")).toBeDefined();
    expect(input.value).toBe("");
    expect(JSON.parse(localStorage.getItem("bay-noise-prefs")!).preferredGenres).toEqual(["indie rock"]);
  });

  it("Enter on a broad genre category adds that chip", async () => {
    const { input, getByLabelText } = await onboard();
    fireEvent.input(input, { target: { value: "punk" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(getByLabelText("Remove punk filter")).toBeDefined();
    expect(input.value).toBe("");
  });

  it("Enter on a venue name adds a venue chip with the canonical name", async () => {
    const { input, getByLabelText } = await onboard();
    fireEvent.input(input, { target: { value: "Bottom of the Hill" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(getByLabelText("Remove Bottom of the Hill, S.F. filter")).toBeDefined();
    expect(input.value).toBe("");
  });

  it("Enter on an artist name adds an artist chip", async () => {
    const { input, getByLabelText } = await onboard();
    fireEvent.input(input, { target: { value: "sad snack" } });
    fireEvent.keyDown(input, { key: "Enter" });
    expect(getByLabelText("Remove Sad Snack filter")).toBeDefined();
    expect(input.value).toBe("");
  });

  it("Enter on unmatched text keeps it as a text search", async () => {
    const { input, getByText, queryByLabelText } = await onboard();
    fireEvent.input(input, { target: { value: "xyzzy" } });
    fireEvent.keyDown(input, { key: "Enter" });
    // Not converted to a chip — stays as free-text search
    expect(input.value).toBe("xyzzy");
    expect(queryByLabelText("Remove xyzzy filter")).toBeNull();
    expect(getByText("No shows match your search.")).toBeDefined();
  });

  it("dismissing a venue chip clears the venue filter", async () => {
    const { input, getByLabelText, queryByLabelText, findByText } = await onboard();
    fireEvent.input(input, { target: { value: "Bottom of the Hill" } });
    fireEvent.keyDown(input, { key: "Enter" });
    await findByText(/1 show/);
    fireEvent.click(getByLabelText("Remove Bottom of the Hill, S.F. filter"));
    expect(queryByLabelText("Remove Bottom of the Hill, S.F. filter")).toBeNull();
    await findByText(/5 shows/);
  });

  it("clicking a venue suggestion sets the venue filter", async () => {
    const { input, getByLabelText, findByTestId } = await onboard();
    fireEvent.input(input, { target: { value: "bottom" } });
    fireEvent.focus(input);
    fireEvent.click(await findByTestId("suggestion-venue-Bottom of the Hill, S.F."));
    expect(getByLabelText("Remove Bottom of the Hill, S.F. filter")).toBeDefined();
    expect(input.value).toBe("");
  });

  it("clicking an artist suggestion sets the artist filter", async () => {
    const { input, getByLabelText, findByTestId } = await onboard();
    fireEvent.input(input, { target: { value: "sad" } });
    fireEvent.focus(input);
    fireEvent.click(await findByTestId("suggestion-artist-Sad Snack"));
    expect(getByLabelText("Remove Sad Snack filter")).toBeDefined();
    expect(input.value).toBe("");
  });

  it("clicking a genre suggestion adds the genre chip", async () => {
    const { input, getByLabelText, findByTestId } = await onboard();
    fireEvent.input(input, { target: { value: "metal" } });
    fireEvent.focus(input);
    fireEvent.click(await findByTestId("suggestion-genre-metal"));
    expect(getByLabelText("Remove metal filter")).toBeDefined();
    expect(input.value).toBe("");
  });
});

describe("iCal subscription URL", () => {
  async function onboard() {
    vi.stubGlobal("fetch", vi.fn(() =>
      Promise.resolve(new Response(JSON.stringify(SAMPLE_SHOWS), {
        status: 200, headers: { "Content-Type": "application/json" },
      })),
    ));
    const utils = render(<App />);
    fireEvent.click(utils.getByText("Show me what's on"));
    const input = (await utils.findByPlaceholderText("Search artists, venues...")) as HTMLInputElement;
    return { ...utils, input };
  }

  it("includes genre, venue, and artist filters as query params", async () => {
    const { input, getByText, container } = await onboard();
    fireEvent.input(input, { target: { value: "metalcore" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.input(input, { target: { value: "Bottom of the Hill" } });
    fireEvent.keyDown(input, { key: "Enter" });
    fireEvent.input(input, { target: { value: "Sad Snack" } });
    fireEvent.keyDown(input, { key: "Enter" });

    fireEvent.click(getByText("Add to Calendar"));
    const code = container.querySelector("code")!;
    expect(code.textContent).toContain("/calendar.ics?");
    expect(code.textContent).toContain("preferred=metalcore");
    expect(code.textContent).toContain("venue=Bottom+of+the+Hill");
    expect(code.textContent).toContain("artist=Sad+Snack");
  });

  it("has no query params when no filters are active", async () => {
    const { getByText, container } = await onboard();
    fireEvent.click(getByText("Add to Calendar"));
    const code = container.querySelector("code")!;
    expect(code.textContent).toMatch(/\/calendar\.ics$/);
  });
});
