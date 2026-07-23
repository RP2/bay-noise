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

  it("shows grouped suggestions when focused and value matches", () => {
    const suggestions = {
      genres: ["punk", "indie rock"],
      venues: ["Bottom of the Hill, S.F."],
      artists: ["Sad Snack"],
    };
    const { getByText, getAllByText, container } = render(
      <SearchBar value="punk" onChange={() => {}} suggestions={suggestions} />,
    );
    const input = container.querySelector("input") as HTMLInputElement;
    fireEvent.focus(input);
    expect(getByText("Did you mean…")).toBeDefined();
    expect(getByText("punk")).toBeDefined();
    expect(getByText("indie rock")).toBeDefined();
    expect(getByText("Bottom of the Hill, S.F.")).toBeDefined();
    expect(getByText("Sad Snack")).toBeDefined();
    // Type labels appear for each suggestion
    expect(getAllByText("(genre)").length).toBe(2);
    expect(getByText("(venue)")).toBeDefined();
    expect(getByText("(artist)")).toBeDefined();
  });

  it("does not show suggestions when value is empty", () => {
    const suggestions = {
      genres: ["punk"],
      venues: ["Bottom of the Hill, S.F."],
      artists: ["Sad Snack"],
    };
    const { queryByText } = render(
      <SearchBar value="" onChange={() => {}} suggestions={suggestions} />,
    );
    expect(queryByText("Did you mean…")).toBeNull();
  });

  it("does not show suggestions when no suggestions prop is provided", () => {
    const { queryByText } = render(<SearchBar value="punk" onChange={() => {}} />);
    expect(queryByText("Did you mean…")).toBeNull();
  });

  it("fires onSuggestionClick when a suggestion is clicked", () => {
    const onSuggestionClick = vi.fn();
    const suggestions = { genres: ["punk"], venues: [], artists: [] };
    const { getByText, container } = render(
      <SearchBar
        value="punk"
        onChange={() => {}}
        suggestions={suggestions}
        onSuggestionClick={onSuggestionClick}
      />,
    );
    const input = container.querySelector("input") as HTMLInputElement;
    fireEvent.focus(input);
    fireEvent.click(getByText("punk"));
    expect(onSuggestionClick).toHaveBeenCalledWith("punk", "genre");
  });

  it("closes dropdown when Enter is pressed", () => {
    const onSubmit = vi.fn();
    const suggestions = { genres: ["punk"], venues: [], artists: [] };
    const { container, queryByText } = render(
      <SearchBar
        value="punk"
        onChange={() => {}}
        onSubmit={onSubmit}
        suggestions={suggestions}
      />,
    );
    const input = container.querySelector("input") as HTMLInputElement;
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onSubmit).toHaveBeenCalledWith("punk");
    expect(queryByText("punk")).toBeNull();
  });

  it("closes dropdown when clear button is clicked", () => {
    const onChange = vi.fn();
    const suggestions = { genres: ["punk"], venues: [], artists: [] };
    const { container, queryByText } = render(
      <SearchBar value="punk" onChange={onChange} suggestions={suggestions} />,
    );
    const clearBtn = container.querySelector("button")!;
    fireEvent.click(clearBtn);
    expect(onChange).toHaveBeenCalledWith("");
    expect(queryByText("punk")).toBeNull();
  });
});
