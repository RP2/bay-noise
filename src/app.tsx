import { useState, useEffect } from "preact/hooks";
import type { ShowsData, FilterState, UserPrefs } from "./lib/types.js";
import { getPrefs, setPrefs } from "./lib/prefs.js";
import { flattenAndScoreShows, sortShows, applyFilters, hasShowsBelowFold } from "./lib/filter.js";
import { Greeter } from "./components/greeter.js";
import { SearchBar } from "./components/search-bar.js";
import { ShowFeed } from "./components/show-feed.js";
import { FeedSubscribe } from "./components/feed-subscribe.js";

type ViewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: ShowsData };

const DEFAULT_FILTER: FilterState = {
  query: "",
  venue: null,
  artist: null,
  showAll: false,
};

export function App() {
  const [prefs, setPrefsState] = useState<UserPrefs>(getPrefs);
  const [view, setView] = useState<ViewState>({ status: "loading" });
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
  const [retryKey, setRetryKey] = useState(0);

  // Fetch data — re-runs when onboarded changes OR when retry is triggered
  useEffect(() => {
    if (!prefs.onboarded) return;

    let cancelled = false;
    setView({ status: "loading" });

    fetch("/shows.json")
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json() as Promise<ShowsData>;
      })
      .then((data) => {
        if (!cancelled) setView({ status: "ready", data });
      })
      .catch((err) => {
        if (!cancelled) setView({ status: "error", message: err.message });
      });

    return () => { cancelled = true; };
  }, [prefs.onboarded, retryKey]);

  // Handle greeter submit
  const handleGreeterSubmit = (genres: string[]) => {
    const newPrefs: UserPrefs = { preferredGenres: genres, onboarded: true };
    setPrefs(newPrefs);
    setPrefsState(newPrefs);
    setFilter(DEFAULT_FILTER);
  };

  // Handle filter changes (partial updates)
  const handleFilterChange = (patch: Partial<FilterState>) => {
    setFilter((prev) => ({ ...prev, ...patch }));
  };

  // Determine app state
  if (!prefs.onboarded) {
    return <Greeter onSubmit={handleGreeterSubmit} />;
  }

  if (view.status === "loading") {
    return (
      <div class="mx-auto max-w-2xl px-4 py-12 text-center">
        <p class="text-gray-500 dark:text-gray-400">Loading shows...</p>
      </div>
    );
  }

  if (view.status === "error") {
    return (
      <div class="mx-auto max-w-2xl px-4 py-12 text-center">
        <p class="mb-4 text-red-500 dark:text-red-400">Failed to load shows.</p>
        <p class="mb-4 text-sm text-gray-500 dark:text-gray-400">{view.message}</p>
        <button
          type="button"
          onClick={() => setRetryKey((k) => k + 1)}
          class="text-sm text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
        >
          Try again
        </button>
      </div>
    );
  }

  // Ready: process + render
  // HD 17: empty preferredGenres → show all shows, no fold
  const forceShowAll = prefs.preferredGenres.length === 0;
  const effectiveFilter = forceShowAll ? { ...filter, showAll: true } : filter;

  const scored = flattenAndScoreShows(view.data.shows, prefs);
  const sorted = sortShows(scored);
  const filtered = applyFilters(sorted, effectiveFilter);
  const belowFold = hasShowsBelowFold(sorted) && !forceShowAll;

  return (
    <div class="mx-auto max-w-2xl px-4 py-6">
      {/* Header */}
      <div class="mb-6 flex items-center justify-between">
        <h1 class="text-2xl font-bold text-black dark:text-white">
          Bay Noise
        </h1>
        <button
          type="button"
          onClick={() => {
            setPrefs({ preferredGenres: [], onboarded: false });
            setPrefsState({ preferredGenres: [], onboarded: false });
          }}
          class="text-xs text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
        >
          Change genres
        </button>
      </div>

      {/* Search */}
      <div class="mb-6">
        <SearchBar
          value={filter.query}
          onChange={(q) => handleFilterChange({ query: q })}
        />
      </div>

      {/* Feed */}
      <ShowFeed
        shows={filtered}
        filter={effectiveFilter}
        onFilterChange={handleFilterChange}
        hasBelowFold={belowFold}
      />

      {/* Footer */}
      <div class="mt-8 border-t border-gray-200 pt-4 dark:border-gray-700">
        <FeedSubscribe />
      </div>
    </div>
  );
}
