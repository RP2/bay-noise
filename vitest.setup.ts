import { vi, afterEach } from "vitest";

/**
 * Global fetch mock for component tests.
 * Tests call mockFetch(data) to provide fixture data.
 * Tests call mockFetchError() to simulate network failure.
 */
const originalFetch = globalThis.fetch;

export function mockFetch(data: unknown) {
  vi.stubGlobal(
    "fetch",
    vi.fn(() =>
      Promise.resolve(
        new Response(JSON.stringify(data), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    ),
  );
}

export function mockFetchError() {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.reject(new Error("Network error"))),
  );
}

export function restoreFetch() {
  vi.stubGlobal("fetch", originalFetch);
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});
