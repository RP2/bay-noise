// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/preact";
import { Greeter } from "./greeter.js";

afterEach(cleanup);

const TEST_GENRES = [
  "punk", "pop punk", "indie rock", "metal", "hip hop", "rap",
  "electronic", "folk", "jazz", "hardcore", "shoegaze", "noise",
  "experimental", "soul", "reggae", "blues", "classical",
];

describe("Greeter", () => {
  it("renders title and subtitle", () => {
    const { getByText } = render(<Greeter genres={TEST_GENRES} onSubmit={() => {}} />);
    expect(getByText("Bay Noise")).toBeDefined();
    expect(getByText("See everything")).toBeDefined();
  });

  it("displays genres grouped by first letter", () => {
    const many = Array.from({ length: 60 }, (_, i) => `genre-${i}`);
    const { getByText, getAllByText } = render(<Greeter genres={many} onSubmit={() => {}} />);
    expect(getByText("genre-0")).toBeDefined();
    expect(getByText("genre-59")).toBeDefined();
    // Two G buttons: jump strip + section header
    expect(getAllByText("G").length).toBe(2);
  });

  it("toggles genre selection on pill click", () => {
    const { getByText } = render(<Greeter genres={TEST_GENRES} onSubmit={() => {}} />);
    fireEvent.click(getByText("punk"));
    expect(getByText("1 selected")).toBeDefined();
    fireEvent.click(getByText("punk"));
    expect(getByText("No genres? We'll show you everything.")).toBeDefined();
  });

  it("submits selected genres", () => {
    const onSubmit = vi.fn();
    const { getByText } = render(<Greeter genres={TEST_GENRES} onSubmit={onSubmit} />);
    fireEvent.click(getByText("punk"));
    fireEvent.click(getByText("indie rock"));
    fireEvent.click(getByText("Show me what's on"));
    expect(onSubmit).toHaveBeenCalledWith(["punk", "indie rock"]);
  });

  it("submits empty array when no genres selected", () => {
    const onSubmit = vi.fn();
    const { getByText } = render(<Greeter genres={TEST_GENRES} onSubmit={onSubmit} />);
    fireEvent.click(getByText("Show me what's on"));
    expect(onSubmit).toHaveBeenCalledWith([]);
  });

  it("shows hint text when no genres selected", () => {
    const { getByText } = render(<Greeter genres={TEST_GENRES} onSubmit={() => {}} />);
    expect(getByText("No genres? We'll show you everything.")).toBeDefined();
  });

  it("shows count when genres selected", () => {
    const { getByText } = render(<Greeter genres={TEST_GENRES} onSubmit={() => {}} />);
    fireEvent.click(getByText("punk"));
    expect(getByText("1 selected")).toBeDefined();
  });
});
