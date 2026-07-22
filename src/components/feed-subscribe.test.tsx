// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/preact";
import { FeedSubscribe } from "./feed-subscribe.js";

afterEach(cleanup);

beforeEach(() => {
  vi.stubGlobal("navigator", {
    clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
  });
});

describe("FeedSubscribe", () => {
  it("renders the calendar URL", () => {
    const { getByText } = render(<FeedSubscribe url="https://example.com/calendar.ics" />);
    expect(getByText("https://example.com/calendar.ics")).toBeDefined();
  });

  it("renders a copy button", () => {
    const { getByText } = render(<FeedSubscribe url="https://example.com/calendar.ics" />);
    expect(getByText("Copy")).toBeDefined();
  });

  it("copies URL when copy button is clicked", async () => {
    const { getByText } = render(<FeedSubscribe url="https://example.com/calendar.ics" />);
    fireEvent.click(getByText("Copy"));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      "https://example.com/calendar.ics",
    );
  });

  it("fires onClose when × is clicked", () => {
    const onClose = vi.fn();
    const { getByLabelText } = render(
      <FeedSubscribe url="https://example.com/calendar.ics" onClose={onClose} />,
    );
    fireEvent.click(getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
