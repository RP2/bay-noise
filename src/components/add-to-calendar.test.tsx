// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/preact";
import { AddToCalendar } from "./add-to-calendar.js";
import type { VenueEvent } from "../lib/types.js";

afterEach(cleanup);

const venue: VenueEvent = {
  name: "Bottom of the Hill, S.F.",
  city: "San Francisco",
  artists: [{ name: "Sad Snack", genres: ["punk"] }],
  extra: "9pm · $15",
  time: "9pm",
  price: "$15",
  age: null,
};

describe("AddToCalendar", () => {
  it("renders a button with label", () => {
    const { getByText } = render(<AddToCalendar date="2026-07-25" venue={venue} />);
    expect(getByText("+ Add to Calendar")).toBeDefined();
  });

  it("triggers download on click", () => {
    const createObjectURL = vi.fn(() => "blob:test");
    const revokeObjectURL = vi.fn();
    vi.stubGlobal("URL", { createObjectURL, revokeObjectURL });

    // Spy on createElement — let the anchor be real so DOM operations work
    let capturedAnchor: HTMLAnchorElement | null = null;
    const origCreateElement = document.createElement.bind(document);
    const createElement = vi.spyOn(document, "createElement").mockImplementation(
      (tag: string) => {
        const el = origCreateElement(tag) as HTMLAnchorElement;
        capturedAnchor = el;
        return el;
      },
    );

    const { getByText } = render(<AddToCalendar date="2026-07-25" venue={venue} />);
    fireEvent.click(getByText("+ Add to Calendar"));

    expect(createElement).toHaveBeenCalledWith("a");
    expect(capturedAnchor).not.toBeNull();
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledTimes(1);

    createElement.mockRestore();
  });

  it("generates a filename based on date and venue", () => {
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:test"),
      revokeObjectURL: vi.fn(),
    });

    let capturedAnchor: HTMLAnchorElement | null = null;
    const origCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation(
      (tag: string) => {
        const el = origCreateElement(tag) as HTMLAnchorElement;
        capturedAnchor = el;
        return el;
      },
    );

    const { getByText } = render(<AddToCalendar date="2026-07-25" venue={venue} />);
    fireEvent.click(getByText("+ Add to Calendar"));

    expect(capturedAnchor).not.toBeNull();
    expect(capturedAnchor!.download).toContain("2026-07-25");
    expect(capturedAnchor!.download).toContain("bottom-of-the-hill");
    expect(capturedAnchor!.download).toContain(".ics");
  });
});
