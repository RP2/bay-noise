// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/preact";
import { ShowCard } from "./show-card.js";
import type { ScoredShow } from "../lib/types.js";

afterEach(cleanup);

const show: ScoredShow = {
  date: "2026-07-25",
  day: "Sat Jul 25",
  venueName: "Bottom of the Hill",
  city: "San Francisco",
  artists: [
    { name: "Sad Snack", genres: ["punk", "indie"], spotifyUrl: "https://open.spotify.com/artist/abc" },
    { name: "Foolish Relics", genres: ["punk"] },
  ],
  extra: "9pm · $15",
  time: "9pm",
  price: "$15",
  age: null,
  score: 2,
};

describe("ShowCard", () => {
  it("renders venue name", () => {
    const { getByText } = render(<ShowCard show={show} />);
    expect(getByText("Bottom of the Hill")).toBeDefined();
  });

  it("renders city", () => {
    const { getByText } = render(<ShowCard show={show} />);
    expect(getByText("San Francisco")).toBeDefined();
  });

  it("renders extra info with genres", () => {
    const { getByText } = render(<ShowCard show={show} />);
    expect(getByText("punk")).toBeDefined();
    expect(getByText("indie")).toBeDefined();
  });

  it("renders all artist names", () => {
    const { getByText } = render(<ShowCard show={show} />);
    expect(getByText("Sad Snack")).toBeDefined();
    expect(getByText("Foolish Relics")).toBeDefined();
  });

  it("renders Spotify link for artists with spotifyUrl", () => {
    const { container } = render(<ShowCard show={show} />);
    const links = container.querySelectorAll('a[href*="spotify"]');
    expect(links.length).toBeGreaterThan(0);
  });

  it("renders show-level genres (deduplicated, comma-separated)", () => {
    const { getByText } = render(<ShowCard show={show} />);
    // punk appears from both artists but should be deduplicated to one entry
    expect(getByText("punk")).toBeDefined();
    expect(getByText("indie")).toBeDefined();
  });

  it("fires onVenueClick when venue name is tapped", () => {
    const onVenueClick = vi.fn();
    const { getByText } = render(<ShowCard show={show} onVenueClick={onVenueClick} />);
    fireEvent.click(getByText("Bottom of the Hill"));
    expect(onVenueClick).toHaveBeenCalledWith("Bottom of the Hill");
  });

  it("fires onArtistClick when artist name is tapped", () => {
    const onArtistClick = vi.fn();
    const { getByText } = render(<ShowCard show={show} onArtistClick={onArtistClick} />);
    fireEvent.click(getByText("Sad Snack"));
    expect(onArtistClick).toHaveBeenCalledWith("Sad Snack");
  });

  it("renders Add to Calendar button", () => {
    const { getByText } = render(<ShowCard show={show} />);
    expect(getByText("+ Add to Calendar")).toBeDefined();
  });

  it("handles null city gracefully", () => {
    const noCity = { ...show, city: null };
    const { container } = render(<ShowCard show={noCity} />);
    // Should still render without city span
    const city = container.querySelector("span.text-neutral-500");
    expect(city).toBeNull();
  });

  it("renders extra without trailing dot when no genres", () => {
    const noGenres: ScoredShow = {
      ...show,
      artists: [{ name: "Genreless Band", genres: [] }],
    };
    const { container } = render(<ShowCard show={noGenres} />);
    const p = container.querySelector("p");
    // Extra content only — no trailing · separator, no genre buttons
    expect(p?.textContent).toBe("9pm · $15");
    expect(p?.querySelector("button")).toBeNull();
  });
});
