import type { ScoredShow, FilterState } from "../lib/types.js";
import { ShowCard } from "./show-card.js";

interface ShowFeedProps {
  shows: ScoredShow[];
  filter: FilterState;
  onFilterChange: (filter: Partial<FilterState>) => void;
  hasBelowFold: boolean;
  dataEmpty?: boolean;
}

export function ShowFeed({ shows, filter, onFilterChange, hasBelowFold, dataEmpty = false }: ShowFeedProps) {
  const grouped = groupByDate(shows);
  const hasAnyFilter = filter.query || filter.venue || filter.artist;

  // HD 17: distinct empty states for no-data vs no-search-match
  if (shows.length === 0) {
    return (
      <div class="py-12 text-center">
        <p class="text-gray-500 dark:text-gray-400">
          {dataEmpty
            ? "No upcoming shows right now. Check back later."
            : "No shows match your search."}
        </p>
        {hasAnyFilter && (
          <button
            type="button"
            onClick={() => onFilterChange({ query: "", venue: null, artist: null, showAll: false })}
            class="mt-2 text-sm text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
          >
            Clear all filters
          </button>
        )}
      </div>
    );
  }

  return (
    <div class="space-y-6">
      {/* Active filters — includes search query */}
      {(filter.venue || filter.artist || filter.query) && (
        <div class="flex flex-wrap items-center gap-2">
          <span class="text-xs font-medium text-gray-500 dark:text-gray-400">Filters:</span>
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
      <p class="text-xs text-gray-400 dark:text-gray-500">
        {shows.length} {shows.length === 1 ? "show" : "shows"}
        {filter.showAll ? " (all)" : " (personalized)"}
      </p>

      {/* Shows grouped by date */}
      {grouped.map(({ date, day, items }) => (
        <section key={date}>
          <h2 class="mb-2 text-sm font-semibold text-gray-700 dark:text-gray-300">
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
            class="text-sm text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300"
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
    <span class="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
      {label}
      <button
        type="button"
        onClick={onClear}
        class="ml-0.5 text-blue-600 hover:text-blue-800 dark:text-blue-300 dark:hover:text-blue-100"
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
