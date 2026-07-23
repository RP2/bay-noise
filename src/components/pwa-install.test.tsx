// @vitest-environment happy-dom
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/preact";
import { PwaInstall } from "./pwa-install.js";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("PwaInstall", () => {
  it("renders install button when not installed", () => {
    const { getByText } = render(<PwaInstall />);
    expect(getByText("Install PWA")).toBeDefined();
  });

  it("renders nothing when already in standalone mode", () => {
    vi.spyOn(window, "matchMedia").mockImplementation((query: string) => ({
      matches: query === "(display-mode: standalone)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    } as unknown as MediaQueryList));

    const { container } = render(<PwaInstall />);
    expect(container.firstChild).toBeNull();
  });
});
