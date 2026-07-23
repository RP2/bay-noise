import { useState, useEffect, useRef } from "preact/hooks";

export interface SearchSuggestions {
  genres: string[];
  venues: string[];
  artists: string[];
}

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  suggestions?: SearchSuggestions | null;
  onSuggestionClick?: (value: string, type: "genre" | "venue" | "artist") => void;
}

const MAX_PER_TYPE = 3;
const MAX_TOTAL = 8;

export function SearchBar({ value, onChange, onSubmit, suggestions, onSuggestionClick }: SearchBarProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close dropdown when the search is cleared.
  useEffect(() => {
    if (!value.trim()) setOpen(false);
  }, [value]);

  // Close dropdown when clicking outside the search bar.
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const trimmed = value.trim().toLowerCase();
  const hasSuggestions = suggestions && trimmed && (
    suggestions.genres.length > 0 ||
    suggestions.venues.length > 0 ||
    suggestions.artists.length > 0
  );

  // Build grouped, capped suggestion list for rendering headers.
  // Cap at ~3 per type and ~8 total (trim from the end: artists, then venues, then genres).
  const groups = [] as { type: "genre" | "venue" | "artist"; title: string; items: string[] }[];
  if (hasSuggestions) {
    if (suggestions!.genres.length > 0) groups.push({ type: "genre", title: "Genres", items: suggestions!.genres.slice(0, MAX_PER_TYPE) });
    if (suggestions!.venues.length > 0) groups.push({ type: "venue", title: "Venues", items: suggestions!.venues.slice(0, MAX_PER_TYPE) });
    if (suggestions!.artists.length > 0) groups.push({ type: "artist", title: "Artists", items: suggestions!.artists.slice(0, MAX_PER_TYPE) });
    let total = groups.reduce((sum, g) => sum + g.items.length, 0);
    while (total > MAX_TOTAL) {
      for (let i = groups.length - 1; i >= 0; i--) {
        if (groups[i].items.length > 0) {
          groups[i].items.pop();
          total--;
          break;
        }
      }
    }
  }

  const handleSuggestionClick = (item: string, type: "genre" | "venue" | "artist") => {
    onSuggestionClick?.(item, type);
    setOpen(false);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !e.isComposing && value.trim()) {
      setOpen(false);
      onSubmit?.(value.trim());
    }
  };

  const handleInput = (e: Event) => {
    const val = (e.target as HTMLInputElement).value;
    onChange(val);
    if (val.trim()) setOpen(true);
  };

  const handleClear = () => {
    onChange("");
    setOpen(false);
  };

  return (
    <div ref={containerRef} class="relative">
      <div class="relative flex items-center">
        <svg class="absolute left-3 h-4 w-4 text-neutral-400 dark:text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
        </svg>
        <input
          type="search"
          value={value}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (value.trim() && hasSuggestions) setOpen(true); }}
          placeholder="Search artists, venues..."
          aria-label="Search shows"
          aria-autocomplete="list"
          aria-expanded={Boolean(open && hasSuggestions)}
          class="w-full min-h-11 border border-neutral-300 bg-white px-3 py-2 pl-9 text-base
                 placeholder-neutral-400 focus:border-black focus:outline-none
                 dark:border-neutral-600 dark:bg-neutral-900 dark:text-white
                 dark:placeholder-neutral-500 dark:focus:border-white"
        />
        {value && (
          <button
            type="button"
            onClick={handleClear}
            class="absolute right-1 flex h-11 w-11 cursor-pointer items-center justify-center text-lg leading-none text-neutral-400 hover:opacity-60
                   dark:text-neutral-500"
            aria-label="Clear search"
          >
            &times;
          </button>
        )}
      </div>

      {/* Temp suggestion chips — "Did you mean?" visual */}
      {open && hasSuggestions && (
        <div class="absolute left-0 right-0 top-full z-20 mt-1 border border-neutral-300 bg-white p-2 dark:border-neutral-600 dark:bg-neutral-900">
          <p class="mb-1 px-1 text-xs text-neutral-400 dark:text-neutral-500">Did you mean…</p>
          <div class="flex flex-wrap gap-1.5">
            {groups.flatMap((group) =>
              group.items.map((item) => (
                <button
                  key={`${group.type}:${item}`}
                  type="button"
                  data-testid={`suggestion-${group.type}-${item}`}
                  onClick={() => handleSuggestionClick(item, group.type)}
                  class="inline-flex cursor-pointer items-center gap-1 rounded-sm border border-neutral-300 bg-neutral-50 px-2 py-1 text-sm text-neutral-800 hover:bg-neutral-200 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-200 dark:hover:bg-neutral-700"
                >
                  <span>{item}</span>
                  <span class="text-xs text-neutral-400 dark:text-neutral-500">({group.type})</span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
