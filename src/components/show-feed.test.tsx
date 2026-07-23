// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/preact";
import { ShowFeed } from "./show-feed.js";
import type { ScoredShow, FilterState } from "../lib/types.js";

afterEach(cleanup);

const mockShows: ScoredShow[] = [
  {
    date: "2026-07-25",
    day: "Sat Jul 25",
    venueName: "Bottom of the Hill",
    city: "San Francisco",
    artists: [{ name: "Sad Snack", genres: ["punk"] }],
    extra: "9pm",
    time: "9pm",
    price: null,
    age: null,
    score: 2,
  },
  {
    date: "2026-07-25",
    day: "Sat Jul 25",
    venueName: "August Hall",
    city: "San Francisco",
    artists: [{ name: "Cab", genres: ["indie"] }],
    extra: "8pm",
    time: "8pm",
    price: null,
    age: null,
    score: 0,
  },
  {
    date: "2026-07-26",
    day: "Sun Jul 26",
    venueName: "924 Gilman",
    city: "Berkeley",
    artists: [{ name: "Spray", genres: ["hardcore"] }],
    extra: "7pm",
    time: "7pm",
    price: null,
    age: null,
    score: 1,
  },
];

const defaultFilter: FilterState = {
  query: "",
  venues: [],
  artists: [],
  cities: [],
  showAll: false,
};

describe("ShowFeed", () => {
  it("renders show cards grouped by date", () => {
    const { getByText } = render(
      <ShowFeed shows={mockShows} filter={defaultFilter} onFilterChange={() => {}} hasBelowFold={true} />,
    );
    expect(getByText("Sat Jul 25")).toBeDefined();
    expect(getByText("Sun Jul 26")).toBeDefined();
    expect(getByText("Bottom of the Hill")).toBeDefined();
    expect(getByText("924 Gilman")).toBeDefined();
  });

  it("shows show count", () => {
    const { getByText } = render(
      <ShowFeed shows={mockShows} filter={defaultFilter} onFilterChange={() => {}} hasBelowFold={true} />,
    );
    expect(getByText("3 shows (personalized)")).toBeDefined();
  });

  it("shows 'all' label when showAll is true", () => {
    const { getByText } = render(
      <ShowFeed shows={mockShows} filter={{ ...defaultFilter, showAll: true }} onFilterChange={() => {}} hasBelowFold={false} />,
    );
    expect(getByText("3 shows (all)")).toBeDefined();
  });

  it("renders 'Show all' link when below fold shows exist", () => {
    const { getByText } = render(
      <ShowFeed shows={mockShows} filter={defaultFilter} onFilterChange={() => {}} hasBelowFold={true} />,
    );
    expect(getByText("Show all upcoming shows")).toBeDefined();
  });

  it("hides 'Show all' link when no below fold shows", () => {
    const { queryByText } = render(
      <ShowFeed shows={mockShows} filter={defaultFilter} onFilterChange={() => {}} hasBelowFold={false} />,
    );
    expect(queryByText("Show all upcoming shows")).toBeNull();
  });

  it("renders filter chips when venue filter is active", () => {
    const { getAllByText } = render(
      <ShowFeed shows={mockShows} filter={{ ...defaultFilter, venues: ["Bottom of the Hill"] }} onFilterChange={() => {}} hasBelowFold={true} />,
    );
    // "Bottom of the Hill" appears in both the filter chip and show card
    expect(getAllByText("Bottom of the Hill").length).toBeGreaterThanOrEqual(1);
  });

  it("renders filter chips when artist filter is active", () => {
    const { getAllByText } = render(
      <ShowFeed shows={mockShows} filter={{ ...defaultFilter, artists: ["Sad Snack"] }} onFilterChange={() => {}} hasBelowFold={true} />,
    );
    expect(getAllByText("Sad Snack").length).toBeGreaterThanOrEqual(1);
  });

  it("clears venue filter when chip × is clicked", () => {
    const onVenueRemove = vi.fn();
    const { getByLabelText } = render(
      <ShowFeed shows={mockShows} filter={{ ...defaultFilter, venues: ["Bottom of the Hill"] }} onFilterChange={() => {}} onVenueRemove={onVenueRemove} hasBelowFold={true} />,
    );
    fireEvent.click(getByLabelText("Remove Bottom of the Hill filter"));
    expect(onVenueRemove).toHaveBeenCalledWith("Bottom of the Hill");
  });

  it("fires showAll when toggle is clicked", () => {
    const onFilterChange = vi.fn();
    const { getByText } = render(
      <ShowFeed shows={mockShows} filter={defaultFilter} onFilterChange={onFilterChange} hasBelowFold={true} />,
    );
    fireEvent.click(getByText("Show all upcoming shows"));
    expect(onFilterChange).toHaveBeenCalledWith({ showAll: true });
  });

  it("shows empty state when no shows match", () => {
    const { getByText } = render(
      <ShowFeed shows={[]} filter={defaultFilter} onFilterChange={() => {}} hasBelowFold={false} />,
    );
    expect(getByText("No shows match your search.")).toBeDefined();
  });

  it("shows clear filters button in empty state when filters are active", () => {
    const onFilterChange = vi.fn();
    const { getByText } = render(
      <ShowFeed shows={[]} filter={{ ...defaultFilter, query: "zzz" }} onFilterChange={onFilterChange} hasBelowFold={false} />,
    );
    fireEvent.click(getByText("Clear all filters"));
    expect(onFilterChange).toHaveBeenCalledWith({ query: "", venues: [], artists: [], cities: [], showAll: false });
  });

  it("allows tapping venue name to set venue filter", () => {
    const onFilterChange = vi.fn();
    const { getByText } = render(
      <ShowFeed shows={mockShows} filter={defaultFilter} onFilterChange={onFilterChange} hasBelowFold={true} />,
    );
    fireEvent.click(getByText("Bottom of the Hill"));
    expect(onFilterChange).toHaveBeenCalledWith({ venues: ["Bottom of the Hill"] });
  });

  it("allows tapping artist name to set artist filter", () => {
    const onFilterChange = vi.fn();
    const { getByText } = render(
      <ShowFeed shows={mockShows} filter={defaultFilter} onFilterChange={onFilterChange} hasBelowFold={true} />,
    );
    fireEvent.click(getByText("Sad Snack"));
    expect(onFilterChange).toHaveBeenCalledWith({ artists: ["Sad Snack"] });
  });
});
