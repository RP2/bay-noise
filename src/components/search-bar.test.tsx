// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/preact";
import { SearchBar } from "./search-bar.js";

afterEach(cleanup);

describe("SearchBar", () => {
  it("renders an input with placeholder", () => {
    const { getByPlaceholderText } = render(<SearchBar value="" onChange={() => {}} />);
    expect(getByPlaceholderText("Search artists, venues...")).toBeDefined();
  });

  it("displays the current value", () => {
    const { container } = render(<SearchBar value="punk" onChange={() => {}} />);
    const input = container.querySelector("input") as HTMLInputElement;
    expect(input.value).toBe("punk");
  });

  it("fires onChange when user types", () => {
    const onChange = vi.fn();
    const { container } = render(<SearchBar value="" onChange={onChange} />);
    const input = container.querySelector("input") as HTMLInputElement;
    fireEvent.input(input, { target: { value: "punk" } });
    expect(onChange).toHaveBeenCalledWith("punk");
  });

  it("shows a clear button when value is non-empty", () => {
    const { container } = render(<SearchBar value="punk" onChange={() => {}} />);
    const clearBtn = container.querySelector("button");
    expect(clearBtn).not.toBeNull();
  });

  it("hides clear button when value is empty", () => {
    const { container } = render(<SearchBar value="" onChange={() => {}} />);
    const clearBtn = container.querySelector("button");
    expect(clearBtn).toBeNull();
  });

  it("clears the value when clear button is clicked", () => {
    const onChange = vi.fn();
    const { container } = render(<SearchBar value="punk" onChange={onChange} />);
    const clearBtn = container.querySelector("button")!;
    fireEvent.click(clearBtn);
    expect(onChange).toHaveBeenCalledWith("");
  });

  it("has aria-label on clear button", () => {
    const { container } = render(<SearchBar value="punk" onChange={() => {}} />);
    const clearBtn = container.querySelector("button");
    expect(clearBtn?.getAttribute("aria-label")).toBe("Clear search");
  });
});
