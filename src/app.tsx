import { useState, useEffect, useMemo, useRef } from "preact/hooks";
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
import { PrivacyModal } from "./components/privacy-modal.js";

type ViewState =
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "ready"; data: ShowsData };

const DEFAULT_FILTER: FilterState = {
  query: "",
  venues: [],
  artists: [],
  cities: [],
  showAll: false,
};

export function App() {
  const [prefs, setPrefsState] = useState<UserPrefs>(getPrefs);
  const [view, setView] = useState<ViewState>({ status: "loading" });
  const [filter, setFilter] = useState<FilterState>(DEFAULT_FILTER);
  const [retryKey, setRetryKey] = useState(0);
  const [showIcal, setShowIcal] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [availableGenres, setAvailableGenres] = useState<string[] | null>(null);

  // Personalized iCal subscription URL. All active filters (preferred
  // genres, venues, artists, cities) are appended as query params so the
  // Cloudflare function returns a matching feed. Without filters, the URL
  // returns the full feed (backwards compatible).
  // NOTE(port): origin is read from window at render time — this app is
  // client-only, but the guard keeps TS happy under non-DOM test shims.
  const origin = typeof window === "undefined" ? "" : window.location.origin;
  let icalUrl = `${origin}/calendar.ics`;
  const icalParams = new URLSearchParams();
  if (prefs.preferredGenres.length > 0)
    icalParams.set("preferred", prefs.preferredGenres.join(","));
  for (const v of filter.venues) icalParams.append("venues", v);
  for (const a of filter.artists) icalParams.append("artists", a);
  for (const c of filter.cities) icalParams.append("cities", c);
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

  // Inject JSON-LD structured data for search engines.
  const jsonLdRef = useRef<HTMLScriptElement | null>(null);
  useEffect(() => {
    if (view.status !== "ready") return;
    if (!jsonLdRef.current) {
      jsonLdRef.current = document.createElement("script");
      jsonLdRef.current.type = "application/ld+json";
      document.head.appendChild(jsonLdRef.current);
    }
    // Compute Pacific timezone offset for a date (PDT -07:00 or PST -08:00).
    // Uses UTC getters on UTC-constructed dates to be timezone-independent.
    function pacificOffset(dateStr: string): string {
      const year = parseInt(dateStr.slice(0, 4), 10);
      const d = new Date(Date.UTC(year, parseInt(dateStr.slice(5, 7), 10) - 1, parseInt(dateStr.slice(8, 10), 10)));
      // 2nd Sunday of March → PDT starts at 2am Pacific
      const marchSecond = new Date(Date.UTC(year, 2, 1));
      marchSecond.setUTCDate(marchSecond.getUTCDate() + (14 - marchSecond.getUTCDay()) % 7 + 7);
      // 1st Sunday of November → PST starts at 2am Pacific
      const novFirst = new Date(Date.UTC(year, 10, 1));
      novFirst.setUTCDate(novFirst.getUTCDate() + (7 - novFirst.getUTCDay()) % 7);
      return d >= marchSecond && d < novFirst ? "-07:00" : "-08:00";
    }

    // Cap at 21 days to stay under Google's ~100KB structured data limit
    // Use local date methods to match the Pacific timezone show dates.
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + 21);
    const cutoffStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, "0")}-${String(cutoff.getDate()).padStart(2, "0")}`;

    const events: object[] = [];
    for (const day of view.data.shows) {
      if (day.date > cutoffStr) break;
      for (const venue of day.venues) {
        // Parse time like "9pm" → "21:00" for ISO date.
        // For "7pm/8pm" (doors/show), use the show time (second value).
        const timeStr = venue.time?.includes("/") ? venue.time.split("/").pop() ?? venue.time : venue.time;
        let startDate = day.date;
        if (timeStr) {
          const m = timeStr.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/i);
          if (m) {
            let h = parseInt(m[1], 10);
            const min = m[2] ? parseInt(m[2], 10) : 0;
            if (m[3].toLowerCase() === "pm" && h !== 12) h += 12;
            if (m[3].toLowerCase() === "am" && h === 12) h = 0;
            const offset = pacificOffset(day.date);
            startDate = `${day.date}T${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:00${offset}`;
          }
        }
        const event: Record<string, unknown> = {
          "@context": "https://schema.org",
          "@type": "Event",
          name: `Show at ${venue.name}`,
          startDate,
          location: {
            "@type": "Place",
            name: venue.name,
          },
          performer: venue.artists.map((a) => ({
            "@type": "MusicGroup",
            name: a.name,
          })),
        };
        const addr: Record<string, string> = { "@type": "PostalAddress" };
        if (venue.address) addr.streetAddress = venue.address;
        if (venue.city) addr.addressLocality = venue.city;
        if (addr.streetAddress || addr.addressLocality) {
          (event.location as Record<string, unknown>).address = addr;
        }
        events.push(event);
      }
    }
    jsonLdRef.current.textContent = JSON.stringify(events);
  }, [view.status === "ready" ? view.data : null]);

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

  const cityNames = useMemo(() => {
    if (view.status !== "ready") return new Map<string, string>();
    const names = new Map<string, string>();
    for (const day of view.data.shows) {
      for (const v of day.venues) {
        if (v.city) {
          const key = v.city.toLowerCase();
          if (!names.has(key)) names.set(key, v.city);
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

  const allCityNames = useMemo(() => {
    if (view.status !== "ready") return [];
    const names = new Set<string>();
    for (const day of view.data.shows) {
      for (const v of day.venues) {
        if (v.city) names.add(v.city);
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
    const activeGenreSet = new Set(prefs.preferredGenres);
    return {
      genres: filterAndRank((availableGenres ?? []).filter((g) => !activeGenreSet.has(g.toLowerCase()))),
      venues: filterAndRank(allVenueNames.filter((v) => !filter.venues.some((fv) => fv.toLowerCase() === v.toLowerCase()))),
      cities: filterAndRank(allCityNames.filter((c) => !filter.cities.some((fc) => fc.toLowerCase() === c.toLowerCase()))),
      artists: filterAndRank(allArtistNames.filter((a) => !filter.artists.some((fa) => fa.toLowerCase() === a.toLowerCase()))),
    };
  }, [
    view.status === "ready" ? view.data : null,
    filter.query,
    filter.venues,
    filter.cities,
    filter.artists,
    prefs.preferredGenres,
    availableGenres,
    allVenueNames,
    allCityNames,
    allArtistNames,
  ]);

  // Apply a suggestion selection the same way an Enter confirmation would.
  const handleSuggestionClick = (
    value: string,
    type: "genre" | "venue" | "city" | "artist",
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
      const lower = value.toLowerCase();
      setFilter((prev) => ({
        ...prev,
        query: "",
        venues: prev.venues.some((v) => v.toLowerCase() === lower)
          ? prev.venues
          : [...prev.venues, value],
      }));
      return;
    }

    if (type === "city") {
      const lower = value.toLowerCase();
      setFilter((prev) => ({
        ...prev,
        query: "",
        cities: prev.cities.some((c) => c.toLowerCase() === lower) ? prev.cities : [...prev.cities, value],
      }));
      return;
    }

    if (type === "artist") {
      const lower = value.toLowerCase();
      setFilter((prev) => ({
        ...prev,
        query: "",
        artists: prev.artists.some((a) => a.toLowerCase() === lower)
          ? prev.artists
          : [...prev.artists, value],
      }));
      return;
    }
  };

  // On Enter: match query against genre → venue → city → artist → keep as text
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
      const lower = venueMatch.toLowerCase();
      setFilter((prev) => ({
        ...prev,
        query: "",
        venues: prev.venues.some((v) => v.toLowerCase() === lower)
          ? prev.venues
          : [...prev.venues, venueMatch],
      }));
      return;
    }

    // Check 3: city name match (after venue, before artist)
    const cityMatch = cityNames.get(trimmed);
    if (cityMatch) {
      const lower = cityMatch.toLowerCase();
      setFilter((prev) => ({
        ...prev,
        query: "",
        cities: prev.cities.some((c) => c.toLowerCase() === lower) ? prev.cities : [...prev.cities, cityMatch],
      }));
      return;
    }

    // Check 4: artist name match
    const artistMatch = artistNames.get(trimmed);
    if (artistMatch) {
      const lower = artistMatch.toLowerCase();
      setFilter((prev) => ({
        ...prev,
        query: "",
        artists: prev.artists.some((a) => a.toLowerCase() === lower)
          ? prev.artists
          : [...prev.artists, artistMatch],
      }));
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

  // Handle removing a single city from the filter
  const handleCityRemove = (city: string) => {
    const lower = city.toLowerCase();
    setFilter((prev) => ({ ...prev, cities: prev.cities.filter((c) => c.toLowerCase() !== lower) }));
  };

  // Handle removing a single venue from the filter
  const handleVenueRemove = (venue: string) => {
    const lower = venue.toLowerCase();
    setFilter((prev) => ({
      ...prev,
      venues: prev.venues.filter((v) => v.toLowerCase() !== lower),
    }));
  };

  // Handle removing a single artist from the filter
  const handleArtistRemove = (artist: string) => {
    const lower = artist.toLowerCase();
    setFilter((prev) => ({
      ...prev,
      artists: prev.artists.filter((a) => a.toLowerCase() !== lower),
    }));
  };

  // Determine app state
  if (!prefs.onboarded) {
    return (
      <>
        <Greeter
          genres={availableGenres ?? []}
          onSubmit={handleGreeterSubmit}
          onShowPrivacy={() => setShowPrivacy(true)}
        />
        {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}
      </>
    );
  }

  if (view.status === "loading") {
    return (
      <>
        <div class="mx-auto max-w-2xl px-4 py-12 text-center">
          <p class="text-neutral-500 dark:text-neutral-400">Loading shows...</p>
        </div>
        {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}
      </>
    );
  }

  if (view.status === "error") {
    return (
      <>
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
        {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}
      </>
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
    <>
      <div class="mx-auto max-w-2xl px-4 py-6">
      {/* Header */}
      <div class="mb-6 flex items-center justify-between">
        <h1 class="hidden sm:block text-lg font-bold text-black dark:text-white">Bay Noise</h1>
        <div class="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setShowIcal((s) => !s)}
            class="cursor-pointer text-xs text-neutral-400 underline-offset-2 hover:underline dark:text-neutral-500 dark:hover:text-white"
          >
            {showIcal ? "Hide" : "Add to Calendar"}
          </button>
          <PwaInstall />
          <button
            type="button"
            onClick={() => setShowPrivacy(true)}
            class="cursor-pointer text-xs text-neutral-400 underline-offset-2 hover:underline dark:text-neutral-500 dark:hover:text-white"
          >
            Privacy
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
        onCityRemove={handleCityRemove}
        onVenueRemove={handleVenueRemove}
        onArtistRemove={handleArtistRemove}
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
      {showPrivacy && <PrivacyModal onClose={() => setShowPrivacy(false)} />}
    </>
  );
}
