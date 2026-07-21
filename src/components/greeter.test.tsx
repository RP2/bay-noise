// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/preact";
import { Greeter } from "./greeter.js";

afterEach(cleanup);

describe("Greeter", () => {
  it("renders title and subtitle", () => {
    const { getByText } = render(<Greeter onSubmit={() => {}} />);
    expect(getByText("Bay Noise")).toBeDefined();
    expect(getByText("Pick your genres. We'll find your shows.")).toBeDefined();
  });

  it("renders all 13 genre categories as pills", () => {
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
    const { getByText } = render(<Greeter onSubmit={() => {}} />);
    const punkPill = getByText("punk");

    // Click to select
    fireEvent.click(punkPill);
    // After click, the pill should be active (using getAllByText since it renders twice now)
    expect(getByText("1 selected")).toBeDefined();

    // Click to deselect
    fireEvent.click(getByText("punk"));
    expect(getByText("No genres? We'll show you everything.")).toBeDefined();
  });

  it("submits selected genres", () => {
    const onSubmit = vi.fn();
    const { getByText } = render(<Greeter onSubmit={onSubmit} />);

    fireEvent.click(getByText("punk"));
    fireEvent.click(getByText("indie"));
    fireEvent.click(getByText("Show me what's on"));

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
    const { getByText } = render(<Greeter onSubmit={() => {}} />);
    fireEvent.click(getByText("punk"));
    expect(getByText("1 selected")).toBeDefined();
  });
});
