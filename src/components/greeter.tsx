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
      <p class="mb-8 text-gray-500 dark:text-gray-400">
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
        class="rounded-lg bg-black px-6 py-2.5 text-sm font-medium text-white
               transition-opacity hover:opacity-80
               dark:bg-white dark:text-black"
      >
        Show me what's on
      </button>

      <p class="mt-3 text-xs text-gray-400 dark:text-gray-500">
        {selected.size === 0
          ? "No genres? We'll show you everything."
          : `${selected.size} selected`}
      </p>
    </div>
  );
}
