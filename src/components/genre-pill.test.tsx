// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/preact";
import { GenrePill } from "./genre-pill.js";

afterEach(cleanup);

describe("GenrePill", () => {
  it("renders the genre name", () => {
    const { getByText } = render(<GenrePill name="punk" />);
    expect(getByText("punk")).toBeDefined();
  });

  it("applies active styling when active is true", () => {
    const { container } = render(<GenrePill name="punk" active />);
    const pill = container.firstChild as HTMLElement;
    expect(pill.className).toContain("bg-neutral-900");
  });

  it("applies inactive styling when active is false", () => {
    const { container } = render(<GenrePill name="punk" />);
    const pill = container.firstChild as HTMLElement;
    expect(pill.className).toContain("bg-neutral-100");
  });

  it("fires onClick when clicked", () => {
    const onClick = vi.fn();
    const { getByText } = render(<GenrePill name="punk" onClick={onClick} />);
    fireEvent.click(getByText("punk"));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not add button role when onClick is not provided", () => {
    const { container } = render(<GenrePill name="punk" />);
    const pill = container.firstChild as HTMLElement;
    expect(pill.getAttribute("role")).toBeNull();
  });

  it("adds button role when onClick is provided", () => {
    const { container } = render(<GenrePill name="punk" onClick={() => {}} />);
    const pill = container.firstChild as HTMLElement;
    expect(pill.getAttribute("role")).toBe("button");
  });

  it("fires onClick on Enter key", () => {
    const onClick = vi.fn();
    const { getByText } = render(<GenrePill name="punk" onClick={onClick} />);
    fireEvent.keyDown(getByText("punk"), { key: "Enter" });
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("fires onClick on Space key", () => {
    const onClick = vi.fn();
    const { getByText } = render(<GenrePill name="punk" onClick={onClick} />);
    fireEvent.keyDown(getByText("punk"), { key: " " });
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});
