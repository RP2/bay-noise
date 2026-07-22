import { useState } from "preact/hooks";
import { getBroadCategories } from "../lib/genres.js";
import { GenrePill } from "./genre-pill.js";

interface GreeterProps {
  onSubmit: (genres: string[]) => void;
}

export function Greeter({ onSubmit }: GreeterProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
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

      <div class="mb-8 flex flex-wrap justify-center gap-2">
        {categories.map((genre) => (
          <GenrePill
            key={genre}
            name={genre}
            active={selected.has(genre)}
            onClick={() => toggle(genre)}
          />
        ))}
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
