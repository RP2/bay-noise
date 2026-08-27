import { describe, it, expect } from "vitest";
import { slugify } from "./slug.js";

describe("slugify", () => {
  it("converts a venue name to a lowercase hyphenated slug", () => {
    expect(slugify("Bottom of the Hill")).toBe("bottom-of-the-hill");
  });

  it("preserves digits", () => {
    expect(slugify("924 Gilman")).toBe("924-gilman");
  });

  it("replaces apostrophes with hyphens", () => {
    expect(slugify("Yes Ma'am")).toBe("yes-ma-am");
  });

  it("caps output at 60 characters", () => {
    const long = "a".repeat(80);
    const result = slugify(long);
    expect(result).toHaveLength(60);
    expect(result).toBe("a".repeat(60));
  });

  it("returns empty string for empty input", () => {
    expect(slugify("")).toBe("");
  });

  it("collapses multiple consecutive special chars into a single hyphen", () => {
    expect(slugify("foo!!!bar")).toBe("foo-bar");
    expect(slugify("a   b")).toBe("a-b");
  });

  it("trims leading and trailing hyphens", () => {
    expect(slugify("--hello--")).toBe("hello");
    expect(slugify("...world...")).toBe("world");
  });

  it("does not leave a trailing hyphen at the 60-char boundary", () => {
    const input = "abc-".repeat(15) + "a";
    const result = slugify(input);
    expect(result).not.toMatch(/-$/);
    expect(result.length).toBeLessThanOrEqual(60);
  });
});
