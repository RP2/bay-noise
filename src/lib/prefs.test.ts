import { describe, it, expect, beforeEach } from "vitest";
import { getPrefs, setPrefs, clearPrefs, isOnboarded, DEFAULT_PREFS } from "./prefs.js";
import type { UserPrefs } from "./types.js";

// happy-dom provides localStorage. Clear before each test.
beforeEach(() => {
  localStorage.clear();
});

describe("getPrefs", () => {
  it("returns default prefs when nothing stored", () => {
    const prefs = getPrefs();
    expect(prefs).toEqual(DEFAULT_PREFS);
  });

  it("returns stored prefs", () => {
    const stored: UserPrefs = { preferredGenres: ["punk", "indie"], onboarded: true };
    localStorage.setItem("bay-noise-prefs", JSON.stringify(stored));
    expect(getPrefs()).toEqual(stored);
  });

  it("returns default prefs on corrupt JSON", () => {
    localStorage.setItem("bay-noise-prefs", "not-json");
    expect(getPrefs()).toEqual(DEFAULT_PREFS);
  });

  it("returns default prefs on null", () => {
    localStorage.setItem("bay-noise-prefs", "null");
    expect(getPrefs()).toEqual(DEFAULT_PREFS);
  });

  it("sanitizes invalid preferredGenres", () => {
    const bad: Record<string, unknown> = {
      preferredGenres: ["punk", null, "", 123, "indie"],
      onboarded: true,
    };
    localStorage.setItem("bay-noise-prefs", JSON.stringify(bad));
    const prefs = getPrefs();
    expect(prefs.preferredGenres).toEqual(["punk", "indie"]);
    expect(prefs.onboarded).toBe(true);
  });

  it("sanitizes non-boolean onboarded", () => {
    const bad: Record<string, unknown> = {
      preferredGenres: [],
      onboarded: "yes",
    };
    localStorage.setItem("bay-noise-prefs", JSON.stringify(bad));
    expect(getPrefs().onboarded).toBe(false);
  });

  it("handles non-object stored value", () => {
    localStorage.setItem("bay-noise-prefs", '"string"');
    expect(getPrefs()).toEqual(DEFAULT_PREFS);
  });

  it("returns a fresh copy each call", () => {
    const a = getPrefs();
    const b = getPrefs();
    expect(a).toEqual(b);
    a.preferredGenres.push("fake");
    expect(b.preferredGenres).not.toContain("fake");
  });
});

describe("setPrefs", () => {
  it("stores prefs that can be read back", () => {
    const prefs: UserPrefs = { preferredGenres: ["punk"], onboarded: true };
    setPrefs(prefs);
    expect(getPrefs()).toEqual(prefs);
  });

  it("overwrites previous prefs", () => {
    setPrefs({ preferredGenres: ["punk"], onboarded: true });
    setPrefs({ preferredGenres: ["indie"], onboarded: false });
    const read = getPrefs();
    expect(read.preferredGenres).toEqual(["indie"]);
    expect(read.onboarded).toBe(false);
  });

  it("throws do not propagate (silent fail)", () => {
    // setPrefs should never throw — wrap in try/catch to assert
    let threw = false;
    try {
      setPrefs({ preferredGenres: [], onboarded: true });
    } catch {
      threw = true;
    }
    expect(threw).toBe(false);
  });
});

describe("clearPrefs", () => {
  it("resets to default prefs", () => {
    setPrefs({ preferredGenres: ["punk"], onboarded: true });
    clearPrefs();
    expect(getPrefs()).toEqual(DEFAULT_PREFS);
  });

  it("is idempotent", () => {
    clearPrefs();
    clearPrefs();
    expect(getPrefs()).toEqual(DEFAULT_PREFS);
  });
});

describe("isOnboarded", () => {
  it("returns false when not stored", () => {
    expect(isOnboarded()).toBe(false);
  });

  it("returns true after onboarding", () => {
    setPrefs({ preferredGenres: ["punk"], onboarded: true });
    expect(isOnboarded()).toBe(true);
  });

  it("returns false when onboarded is false", () => {
    setPrefs({ preferredGenres: [], onboarded: false });
    expect(isOnboarded()).toBe(false);
  });
});
