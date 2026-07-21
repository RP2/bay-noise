import { vi, afterEach } from "vitest";

/**
 * Global fetch mock for component tests.
 * Tests call mockFetch(data) to provide fixture data.
 * Tests call mockFetchError() to simulate network failure.
 */
const originalFetch = globalThis.fetch;

/**
 * Vitest v4 + Node 26 + happy-dom has inconsistent localStorage support.
 * Ensure it's always available by providing a simple in-memory mock
 * via direct assignment to globalThis.
 */
if (typeof globalThis.localStorage === "undefined" || globalThis.localStorage === null) {
  const lsStore = new Map<string, string>();
  (globalThis as Record<string, unknown>).localStorage = {
    get length() { return lsStore.size; },
    clear() { lsStore.clear(); },
    getItem(key: string) { return lsStore.get(String(key)) ?? null; },
    key(index: number) { return [...lsStore.keys()][Number(index)] ?? null; },
    removeItem(key: string) { lsStore.delete(String(key)); },
    setItem(key: string, value: string) { lsStore.set(String(key), String(value)); },
  } satisfies Storage;
}

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
