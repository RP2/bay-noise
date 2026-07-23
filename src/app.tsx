import { useState, useEffect, useMemo } from "preact/hooks";
import type { ShowsData, FilterState, UserPrefs } from "./lib/types.js";
import { getPrefs, setPrefs } from "./lib/prefs.js";
import type { SearchSuggestions } from "./components/search-bar.js";
import {
  flattenAndScoreShows,
  sortShows,
  applyFilters,
  hasShowsBelowFold,
} from "./lib/filter.js";
import { Greeter } from "./components/greeter.js";
import { SearchBar } from "./components/search-bar.js";
import { ShowFeed } from "./components/show-feed.js";
import { FeedSubscribe } from "./components/feed-subscribe.js";
import { PwaInstall } from "./components/pwa-install.js";

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
  const [availableGenres, setAvailableGenres] = useState<string[] | null>(null);

  // Personalized iCal subscription URL. All active filters (preferred
  // genres, venue, artist) are appended as query params so the Cloudflare
  // function returns a matching feed. Without filters, the URL returns
  // the full feed (backwards compatible).
  // NOTE(port): origin is read from window at render time — this app is
  // client-only, but the guard keeps TS happy under non-DOM test shims.
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  let icalUrl = `${origin}/calendar.ics`;
  const icalParams = new URLSearchParams();
  if (prefs.preferredGenres.length > 0)
    icalParams.set("preferred", prefs.preferredGenres.join(","));
  if (filter.venue) icalParams.set("venue", filter.venue);
  if (filter.artist) icalParams.set("artist", filter.artist);
  if ([...icalParams].length > 0) icalUrl += "?" + icalParams.toString();

  // Fetch available genres for the greeter (runs once on mount)
  useEffect(() => {
    fetch("/available-genres.json")
      .then((r) => r.json() as Promise<string[]>)
      .then((g) => setAvailableGenres(g))
      .catch(() => setAvailableGenres([]));
  }, []);

  // Fetch show data — re-runs when onboarded changes OR when retry is triggered
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

    return () => {
      cancelled = true;
    };
  }, [prefs.onboarded, retryKey]);

  // Handle greeter submit
  const handleGreeterSubmit = (genres: string[]) => {
    const newPrefs: UserPrefs = { preferredGenres: genres, onboarded: true };
    setPrefs(newPrefs);
    setPrefsState(newPrefs);
    setFilter(DEFAULT_FILTER);
  };

  // Build searchable venue/artist lookups from loaded show data.
  // Maps lowercase name → canonical name (for chip labels).
  const venueNames = useMemo(() => {
    if (view.status !== "ready") return new Map<string, string>();
    const names = new Map<string, string>();
    for (const day of view.data.shows) {
      for (const v of day.venues) {
        const full = v.name.toLowerCase();
        if (!names.has(full)) names.set(full, v.name);
        // Also match the name without the ", City" suffix so typing
        // "bottom of the hill" matches "Bottom of the Hill, S.F."
        const short = v.name.split(",")[0].trim().toLowerCase();
        if (short && !names.has(short)) names.set(short, v.name);
      }
    }
    return names;
  }, [view.status === "ready" ? view.data : null]);

  const artistNames = useMemo(() => {
    if (view.status !== "ready") return new Map<string, string>();
    const names = new Map<string, string>();
    for (const day of view.data.shows) {
      for (const v of day.venues) {
        for (const a of v.artists) {
          const key = a.name.toLowerCase();
          if (!names.has(key)) names.set(key, a.name);
        }
      }
    }
    return names;
  }, [view.status === "ready" ? view.data : null]);

  // Build sorted, unique suggestion lists for the search bar dropdown.
  const allVenueNames = useMemo(() => {
    if (view.status !== "ready") return [];
    const names = new Set<string>();
    for (const day of view.data.shows) {
      for (const v of day.venues) names.add(v.name);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [view.status === "ready" ? view.data : null]);

  const allArtistNames = useMemo(() => {
    if (view.status !== "ready") return [];
    const names = new Set<string>();
    for (const day of view.data.shows) {
      for (const v of day.venues) {
        for (const a of v.artists) names.add(a.name);
      }
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [view.status === "ready" ? view.data : null]);

  const suggestions: SearchSuggestions | null = useMemo(() => {
    if (view.status !== "ready") return null;
    const query = filter.query.trim().toLowerCase();
    if (!query) return null;
    const rank = (value: string) => {
      const lower = value.toLowerCase();
      if (lower === query) return 0;
      if (lower.startsWith(query)) return 1;
      return 2;
    };
    const filterAndRank = (values: string[]) =>
      values
        .filter((v) => v.toLowerCase().includes(query))
        .sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
    return {
      genres: filterAndRank(availableGenres ?? []),
      venues: filterAndRank(allVenueNames),
      artists: filterAndRank(allArtistNames),
    };
  }, [
    view.status === "ready" ? view.data : null,
    filter.query,
    allVenueNames,
    allArtistNames,
  ]);

  // Apply a suggestion selection the same way an Enter confirmation would.
  const handleSuggestionClick = (
    value: string,
    type: "genre" | "venue" | "artist",
  ) => {
    if (type === "genre") {
      const genreMatch = value.toLowerCase();
      if (!prefs.preferredGenres.includes(genreMatch)) {
        const updated = [...prefs.preferredGenres, genreMatch];
        setPrefs({ ...prefs, preferredGenres: updated });
        setPrefsState({ ...prefs, preferredGenres: updated });
      }
      setFilter((prev) => ({ ...prev, query: "" }));
      return;
    }

    if (type === "venue") {
      setFilter((prev) => ({ ...prev, query: "", venue: value }));
      return;
    }

    if (type === "artist") {
      setFilter((prev) => ({ ...prev, query: "", artist: value }));
      return;
    }
  };

  // On Enter: match query against genre → venue → artist → keep as text
  const handleSearchSubmit = (query: string) => {
    const trimmed = query.toLowerCase().trim();
    if (!trimmed) return;

    // Check 1: exact match against any known genre string
    const genreMatch = (availableGenres ?? []).find((g) => g.toLowerCase() === trimmed);
    if (genreMatch) {
      if (!prefs.preferredGenres.includes(genreMatch.toLowerCase())) {
        const updated = [...prefs.preferredGenres, genreMatch.toLowerCase()];
        setPrefs({ ...prefs, preferredGenres: updated });
        setPrefsState({ ...prefs, preferredGenres: updated });
      }
      setFilter((prev) => ({ ...prev, query: "" }));
      return;
    }

    // Check 2: venue name match
    const venueMatch = venueNames.get(trimmed);
    if (venueMatch) {
      setFilter((prev) => ({ ...prev, query: "", venue: venueMatch }));
      return;
    }

    // Check 3: artist name match
    const artistMatch = artistNames.get(trimmed);
    if (artistMatch) {
      setFilter((prev) => ({ ...prev, query: "", artist: artistMatch }));
      return;
    }

    // No match — keep as text search (query already set by handleSearchChange)
  };

  // OnChange: plain text search — never auto-converts to chips.
  // Chips are only added on explicit Enter (handleSearchSubmit), so typing
  // "metalcore" is never hijacked mid-word by a "metal" match.
  const handleSearchChange = (q: string) => {
    setFilter((prev) => ({ ...prev, query: q }));
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
    return (
      <Greeter
        genres={availableGenres ?? []}
        onSubmit={handleGreeterSubmit}
      />
    );
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
        <p class="mb-4 text-neutral-600 dark:text-neutral-400">
          Failed to load shows.
        </p>
        <p class="mb-4 text-sm text-neutral-500 dark:text-neutral-400">
          {view.message}
        </p>
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
        <h1 class="hidden sm:block text-lg font-bold text-black dark:text-white">Bay Noise</h1>
        <div class="flex items-center gap-3">
          <PwaInstall />
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
            Reopen greeter
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
          onChange={handleSearchChange}
          onSubmit={handleSearchSubmit}
          suggestions={suggestions}
          onSuggestionClick={handleSuggestionClick}
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
          // Add the clicked genre string directly as its own filter
          if (!prefs.preferredGenres.includes(genre.toLowerCase())) {
            const updated = [...prefs.preferredGenres, genre.toLowerCase()];
            const newPrefs: UserPrefs = { ...prefs, preferredGenres: updated };
            setPrefs(newPrefs);
            setPrefsState(newPrefs);
          }
        }}
      />
    </div>
  );
}
