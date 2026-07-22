import type { ScoredShow, FilterState } from "../lib/types.js";
import { ShowCard } from "./show-card.js";

interface ShowFeedProps {
  shows: ScoredShow[];
  filter: FilterState;
  onFilterChange: (filter: Partial<FilterState>) => void;
  hasBelowFold: boolean;
  dataEmpty?: boolean;
  preferredGenres?: string[];
  onGenreRemove?: (genre: string) => void;
}

export function ShowFeed({ shows, filter, onFilterChange, hasBelowFold, dataEmpty = false, preferredGenres = [], onGenreRemove }: ShowFeedProps) {
  const grouped = groupByDate(shows);
  const hasAnyFilter = filter.query || filter.venue || filter.artist;

  // HD 17: distinct empty states for no-data vs no-search-match
  if (shows.length === 0) {
    return (
      <div class="py-12 text-center">
        <p class="text-neutral-500 dark:text-neutral-400">
          {dataEmpty
            ? "No upcoming shows right now. Check back later."
            : "No shows match your search."}
        </p>
        {hasAnyFilter && (
          <button
            type="button"
            onClick={() => onFilterChange({ query: "", venue: null, artist: null, showAll: false })}
            class="mt-2 inline-flex min-h-11 cursor-pointer items-center text-sm text-neutral-600 underline-offset-2 hover:underline dark:text-neutral-400 dark:hover:text-white"
          >
            Clear all filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div class="space-y-6">
      {/* Active filters — search query, genre, venue, artist */}
      {(filter.query || filter.venue || filter.artist || preferredGenres.length > 0) && (
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs font-medium text-neutral-500 dark:text-neutral-400">Filters:</span>
          {preferredGenres.map((g) => (
            <FilterChip key={g} label={g} onClear={() => onGenreRemove?.(g)} />
          ))}
          {filter.query && (
            <FilterChip label={`"${filter.query}"`} onClear={() => onFilterChange({ query: "" })} />
          )}
          {filter.venue && (
            <FilterChip label={filter.venue} onClear={() => onFilterChange({ venue: null })} />
          )}
          {filter.artist && (
            <FilterChip label={filter.artist} onClear={() => onFilterChange({ artist: null })} />
          )}
        </div>
      )}

      {/* Show count */}
      <p class="text-xs text-neutral-400 dark:text-neutral-500">
        {shows.length} {shows.length === 1 ? "show" : "shows"}
        {filter.showAll ? " (all)" : " (personalized)"}
      </p>

      {/* Shows grouped by date */}
      {grouped.map(({ date, day, items }) => (
        <section key={date}>
          <h2 class="mb-2 text-sm font-semibold text-neutral-800 dark:text-neutral-200">
            {day}
          </h2>
          <div class="space-y-3">
            {items.map((show, i) => (
              <ShowCard
                key={`${show.date}-${show.venueName}-${i}`}
                show={show}
                onVenueClick={(v) => onFilterChange({ venue: v })}
                onArtistClick={(a) => onFilterChange({ artist: a })}
              />
            ))}
          </div>
        </section>
      ))}

      {/* Show all toggle */}
      {!filter.showAll && hasBelowFold && (
        <div class="text-center">
          <button
            type="button"
            onClick={() => onFilterChange({ showAll: true })}
            class="inline-flex min-h-11 cursor-pointer items-center text-sm text-neutral-600 underline-offset-2 hover:underline dark:text-neutral-400 dark:hover:text-white"
          >
            Show all upcoming shows
          </button>
        </div>
      )}
    </div>
  );
}

interface FilterChipProps {
  label: string;
  onClear: () => void;
}

function FilterChip({ label, onClear }: FilterChipProps) {
  return (
    <span class="inline-flex items-center gap-1 border border-neutral-300 bg-neutral-100 px-2 py-1 text-xs dark:border-neutral-600 dark:bg-neutral-800">
      {label}
      <button
        type="button"
        onClick={onClear}
        class="inline-flex h-7 w-7 cursor-pointer items-center justify-center leading-none text-neutral-500 hover:text-black dark:text-neutral-400 dark:hover:text-white"
        aria-label={`Remove ${label} filter`}
      >
        &times;
      </button>
    </span>
  );
}

// ── Helpers ──

interface DayGroup {
  date: string;
  day: string;
  items: ScoredShow[];
}

function groupByDate(shows: ScoredShow[]): DayGroup[] {
  const groups: DayGroup[] = [];
  let current: DayGroup | null = null;

  for (const show of shows) {
    if (!current || current.date !== show.date) {
      current = { date: show.date, day: show.day, items: [] };
      groups.push(current);
    }
    current.items.push(show);
  }

  return groups;
}
