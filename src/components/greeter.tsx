import { useState } from "preact/hooks";
import { getBroadCategories, getGenresForCategory } from "../lib/genres.js";
import { GenrePill } from "./genre-pill.js";

interface GreeterProps {
  onSubmit: (genres: string[]) => void;
}

export function Greeter({ onSubmit }: GreeterProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const categories = getBroadCategories();

  const toggle = (genre: string) => {
    const next = new Set(selected);
    if (next.has(genre)) {
      next.delete(genre);
    } else {
      next.add(genre);
    }
    setSelected(next);
  };

  const toggleExpand = (cat: string) => {
    const next = new Set(expanded);
    if (next.has(cat)) {
      next.delete(cat);
    } else {
      next.add(cat);
    }
    setExpanded(next);
  };

  const handleSubmit = () => {
    onSubmit([...selected]);
  };

  return (
    <div class="mx-auto max-w-md px-4 py-12 text-center">
      <h1 class="mb-2 text-3xl font-bold text-black dark:text-white">
        Bay Noise
      </h1>
      <p class="mb-8 text-neutral-500 dark:text-neutral-400">
        Pick your genres. We'll find your shows.
      </p>

      <div class="mb-8 text-left">
        {categories.map((category) => {
          const genres = getGenresForCategory(category);
          const isExpanded = expanded.has(category);
          return (
            <div key={category} class="mb-2">
              <button
                type="button"
                onClick={() => toggleExpand(category)}
                class="flex w-full items-center justify-between rounded px-2 py-1 text-left text-sm font-medium text-neutral-800 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800"
              >
                <span class="capitalize">{category}</span>
                <span class="ml-2 rounded-full bg-neutral-200 px-2 py-0.5 text-xs text-neutral-600 dark:bg-neutral-700 dark:text-neutral-300">
                  {genres.length}
                </span>
              </button>
              {isExpanded && (
                <div class="mt-1 flex flex-wrap gap-2 px-2">
                  {genres.map((genre) => (
                    <GenrePill
                      key={genre}
                      name={genre}
                      active={selected.has(genre)}
                      onClick={() => toggle(genre)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={handleSubmit}
        class="cursor-pointer border border-black bg-black px-8 py-3 text-sm font-medium text-white
               hover:bg-white hover:text-black
               dark:border-white dark:bg-white dark:text-black
               dark:hover:bg-black dark:hover:text-white"
      >
        Show me what's on
      </button>

      <p class="mt-3 text-xs text-neutral-400 dark:text-neutral-500">
        {selected.size === 0
          ? "No genres? We'll show you everything."
          : `${selected.size} selected`}
      </p>
    </div>
  );
}
