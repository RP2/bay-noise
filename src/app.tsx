import { useState, useEffect } from "preact/hooks";
import type { ShowsData, FilterState, UserPrefs } from "./lib/types.js";
import { getPrefs, setPrefs } from "./lib/prefs.js";
import { getBroadCategories, classifyGenre } from "./lib/genres.js";
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
  const [showIcal, setShowIcal] = useState(false);

  // Personalized iCal subscription URL. When the user has preferred genres,
  // append ?preferred=... so the Cloudflare function filters the feed to
  // just matching shows. Without prefs, the URL returns the full feed.
  // NOTE(port): origin is read from window at render time — this app is
  // client-only, but the guard keeps TS happy under non-DOM test shims.
  const icalUrl = typeof window === "undefined"
    ? "/calendar.ics"
    : (prefs.preferredGenres.length > 0
      ? `${window.location.origin}/calendar.ics?preferred=${encodeURIComponent(prefs.preferredGenres.map((g) => g.toLowerCase()).join(","))}`
      : `${window.location.origin}/calendar.ics`);

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

  // Handle search input change — converts genre matches to chips in real time
  const handleSearchChange = (q: string) => {
    const trimmed = q.toLowerCase().trim();
    const categories = getBroadCategories();
    const matching = categories.find((c) => c.toLowerCase() === trimmed);
    if (matching && !prefs.preferredGenres.includes(matching)) {
      const updated = [...prefs.preferredGenres, matching];
      const newPrefs: UserPrefs = { ...prefs, preferredGenres: updated };
      setPrefs(newPrefs);
      setPrefsState(newPrefs);
      setFilter((prev) => ({ ...prev, query: "" }));
    } else {
      setFilter((prev) => ({ ...prev, query: q }));
    }
  };

  // Handle search submit: Enter key — same logic as onChange
  const handleSearchSubmit = (query: string) => {
    handleSearchChange(query);
  };

  // Handle filter changes (partial updates)
  const handleFilterChange = (patch: Partial<FilterState>) => {
    setFilter((prev) => ({ ...prev, ...patch }));
  };

  // Handle removing a single genre from preferred list
  const handleGenreRemove = (genre: string) => {
    const updated = prefs.preferredGenres.filter((g) => g !== genre);
    const newPrefs: UserPrefs = { ...prefs, preferredGenres: updated };
    setPrefs(newPrefs);
    setPrefsState(newPrefs);
  };

  // Determine app state
  if (!prefs.onboarded) {
    return <Greeter onSubmit={handleGreeterSubmit} />;
  }

  if (view.status === "loading") {
    return (
      <div class="mx-auto max-w-2xl px-4 py-12 text-center">
        <p class="text-neutral-500 dark:text-neutral-400">Loading shows...</p>
      </div>
    );
  }

  if (view.status === "error") {
    return (
      <div class="mx-auto max-w-2xl px-4 py-12 text-center">
        <p class="mb-4 text-neutral-600 dark:text-neutral-400">Failed to load shows.</p>
        <p class="mb-4 text-sm text-neutral-500 dark:text-neutral-400">{view.message}</p>
        <button
          type="button"
          onClick={() => setRetryKey((k) => k + 1)}
          class="cursor-pointer text-sm text-neutral-600 underline-offset-2 hover:underline dark:text-neutral-400 dark:hover:text-white"
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
        <div class="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowIcal((s) => !s)}
            class="cursor-pointer text-xs text-neutral-400 underline-offset-2 hover:underline dark:text-neutral-500 dark:hover:text-white"
          >
            {showIcal ? "Hide" : "Add to Calendar"}
          </button>
          <button
            type="button"
            onClick={() => {
              setPrefs({ preferredGenres: [], onboarded: false });
              setPrefsState({ preferredGenres: [], onboarded: false });
            }}
            class="cursor-pointer text-xs text-neutral-400 underline-offset-2 hover:underline dark:text-neutral-500 dark:hover:text-white"
          >
            Change genres
          </button>
        </div>
      </div>

      {/* iCal subscription panel (personalized to preferred genres) */}
      {showIcal && (
        <div class="mb-6">
          <FeedSubscribe url={icalUrl} onClose={() => setShowIcal(false)} />
        </div>
      )}

      {/* Search */}
      <div class="mb-6">
        <SearchBar
          value={filter.query}
          onChange={(q) => handleFilterChange({ query: q })}
          onSubmit={handleSearchSubmit}
        />
      </div>

      {/* Feed */}
      <ShowFeed
        shows={filtered}
        filter={effectiveFilter}
        onFilterChange={handleFilterChange}
        hasBelowFold={belowFold}
        preferredGenres={prefs.preferredGenres}
        onGenreRemove={handleGenreRemove}
        onGenreClick={(genre) => {
          const broad = classifyGenre(genre);
          if (broad !== "other" && !prefs.preferredGenres.includes(broad)) {
            const updated = [...prefs.preferredGenres, broad];
            const newPrefs: UserPrefs = { ...prefs, preferredGenres: updated };
            setPrefs(newPrefs);
            setPrefsState(newPrefs);
          } else if (broad === "other") {
            // Unknown genre — set as search query
            handleFilterChange({ query: genre.toLowerCase() });
          }
        }}
      />

    </div>
  );
}
