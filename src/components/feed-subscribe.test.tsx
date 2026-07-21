// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/preact";
import { FeedSubscribe } from "./feed-subscribe.js";

afterEach(cleanup);

beforeEach(() => {
  // Set a stable origin for testing
  Object.defineProperty(window, "location", {
    value: { origin: "https://bay-noise.pages.dev" },
    writable: true,
  });
});

describe("FeedSubscribe", () => {
  it("renders summary text", () => {
    const { getByText } = render(<FeedSubscribe />);
    expect(getByText("Subscribe via iCal")).toBeDefined();
  });

  it("shows the calendar URL when expanded", () => {
    const { getByText } = render(<FeedSubscribe />);
    fireEvent.click(getByText("Subscribe via iCal"));
    expect(getByText("https://bay-noise.pages.dev/calendar.ics")).toBeDefined();
  });

  it("renders a copy button", () => {
    const { getByText } = render(<FeedSubscribe />);
    fireEvent.click(getByText("Subscribe via iCal"));
    expect(getByText("Copy")).toBeDefined();
  });

  it("copies URL to clipboard when copy is clicked", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
    });

    const { getByText } = render(<FeedSubscribe />);
    fireEvent.click(getByText("Subscribe via iCal"));
    fireEvent.click(getByText("Copy"));

    expect(writeText).toHaveBeenCalledWith("https://bay-noise.pages.dev/calendar.ics");
  });
});
