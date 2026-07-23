// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/preact";
import { Greeter } from "./greeter.js";

afterEach(cleanup);

/**
 * Get a selectable genre pill by its text. The category header also displays
 * the same text, so this helper resolves the pill (the second text match).
 */
function getGenrePill(utils: ReturnType<typeof render>, name: string) {
  const matches = utils.getAllByText(name);
  // First match is the category header span, second is the pill.
  return matches[1];
}

describe("Greeter", () => {
  it("renders title and subtitle", () => {
    const { getByText } = render(<Greeter onSubmit={() => {}} />);
    expect(getByText("Bay Noise")).toBeDefined();
    expect(getByText("Pick your genres. We'll find your shows.")).toBeDefined();
  });

  it("renders all 13 genre categories as headers", () => {
    const { getByText } = render(<Greeter onSubmit={() => {}} />);
    expect(getByText("punk")).toBeDefined();
    expect(getByText("indie")).toBeDefined();
    expect(getByText("metal")).toBeDefined();
    expect(getByText("hiphop")).toBeDefined();
    expect(getByText("electronic")).toBeDefined();
    expect(getByText("folk")).toBeDefined();
    expect(getByText("jazz")).toBeDefined();
    expect(getByText("hardcore")).toBeDefined();
    expect(getByText("shoegaze")).toBeDefined();
    expect(getByText("noise")).toBeDefined();
    expect(getByText("experimental")).toBeDefined();
    expect(getByText("soul")).toBeDefined();
    expect(getByText("hipster")).toBeDefined();
  });

  it("toggles genre selection on pill click", () => {
    const utils = render(<Greeter onSubmit={() => {}} />);
    // Expand the punk category to reveal its genre pills
    fireEvent.click(utils.getByText("punk"));
    const punkPill = getGenrePill(utils, "punk");

    // Click to select
    fireEvent.click(punkPill);
    expect(utils.getByText("1 selected")).toBeDefined();

    // Click to deselect
    fireEvent.click(punkPill);
    expect(utils.getByText("No genres? We'll show you everything.")).toBeDefined();
  });

  it("submits selected genres", () => {
    const onSubmit = vi.fn();
    const utils = render(<Greeter onSubmit={onSubmit} />);

    // Expand each category and select the base genre pill
    fireEvent.click(utils.getByText("punk"));
    fireEvent.click(getGenrePill(utils, "punk"));
    fireEvent.click(utils.getByText("indie"));
    fireEvent.click(getGenrePill(utils, "indie"));
    fireEvent.click(utils.getByText("Show me what's on"));

    expect(onSubmit).toHaveBeenCalledWith(["punk", "indie"]);
  });

  it("submits empty array when no genres selected", () => {
    const onSubmit = vi.fn();
    const { getByText } = render(<Greeter onSubmit={onSubmit} />);
    fireEvent.click(getByText("Show me what's on"));
    expect(onSubmit).toHaveBeenCalledWith([]);
  });

  it("shows hint text when no genres selected", () => {
    const { getByText } = render(<Greeter onSubmit={() => {}} />);
    expect(getByText("No genres? We'll show you everything.")).toBeDefined();
  });

  it("shows count when genres selected", () => {
    const utils = render(<Greeter onSubmit={() => {}} />);
    fireEvent.click(utils.getByText("punk"));
    fireEvent.click(getGenrePill(utils, "punk"));
    expect(utils.getByText("1 selected")).toBeDefined();
  });
});
