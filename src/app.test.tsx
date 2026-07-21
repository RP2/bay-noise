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

    fireEvent.click(getByText("Change genres"));
    expect(getByText("Pick your genres. We'll find your shows.")).toBeDefined();
  });
});
