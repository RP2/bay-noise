// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, fireEvent, cleanup } from "@testing-library/preact";
import { PrivacyModal } from "./privacy-modal.js";

afterEach(cleanup);

describe("PrivacyModal", () => {
  it("renders the privacy policy heading", () => {
    const { getByText } = render(<PrivacyModal onClose={vi.fn()} />);
    expect(getByText("Privacy")).toBeDefined();
  });

  it("renders key privacy statements", () => {
    const { getByText } = render(<PrivacyModal onClose={vi.fn()} />);
    expect(getByText("no cookies", { exact: false })).toBeDefined();
    expect(getByText("localStorage", { exact: false })).toBeDefined();
    expect(getByText("Calendar feed", { exact: false })).toBeDefined();
  });

  it("fires onClose when close button is clicked", () => {
    const onClose = vi.fn();
    const { getByLabelText } = render(<PrivacyModal onClose={onClose} />);
    fireEvent.click(getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("fires onClose on Escape key", () => {
    const onClose = vi.fn();
    render(<PrivacyModal onClose={onClose} />);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("sets body overflow to hidden on mount", () => {
    render(<PrivacyModal onClose={vi.fn()} />);
    expect(document.body.style.overflow).toBe("hidden");
  });

  it("restores body overflow on unmount", () => {
    document.body.style.overflow = "visible";
    const { unmount } = render(<PrivacyModal onClose={vi.fn()} />);
    unmount();
    expect(document.body.style.overflow).toBe("visible");
  });

  it("fires onClose when backdrop is clicked", () => {
    const onClose = vi.fn();
    const { container } = render(<PrivacyModal onClose={onClose} />);
    // The backdrop is the outermost div (the one with onClick)
    const backdrop = container.firstElementChild!;
    fireEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not fire onClose when clicking inside the modal content", () => {
    const onClose = vi.fn();
    const { getByText } = render(<PrivacyModal onClose={onClose} />);
    fireEvent.click(getByText("Privacy"));
    expect(onClose).toHaveBeenCalledTimes(0);
  });
});
