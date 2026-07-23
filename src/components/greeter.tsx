import { useState, useRef, useMemo } from "preact/hooks";
import { GenrePill } from "./genre-pill.js";

const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

interface GreeterProps {
  genres: string[];
  onSubmit: (genres: string[]) => void;
}

export function Greeter({ genres, onSubmit }: GreeterProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const listRef = useRef<HTMLDivElement>(null);

  // Group genres by first letter
  const grouped = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const g of genres) {
      const letter = g[0].toUpperCase();
      if (!map.has(letter)) map.set(letter, []);
      map.get(letter)!.push(g);
    }
    // Return sorted by letter
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [genres]);

  const toggle = (genre: string) => {
    const next = new Set(selected);
    if (next.has(genre)) next.delete(genre);
    else next.add(genre);
    setSelected(next);
  };

  const scrollToLetter = (letter: string) => {
    const el = document.getElementById(`genre-${letter}`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const handleSubmit = () => {
    onSubmit([...selected]);
  };

  return (
    <div class="mx-auto max-w-2xl px-4 py-12">
      <h1 class="mb-2 text-center text-3xl font-bold text-black dark:text-white">
        Bay Noise
      </h1>
      <p class="mb-8 text-center text-neutral-500 dark:text-neutral-400">
        Pick your genres. We'll find your shows. Or...{" "}
        <button
          type="button"
          onClick={() => onSubmit([])}
          class="cursor-pointer underline underline-offset-2 hover:text-black dark:hover:text-white"
        >
          See everything
        </button>
        .
      </p>

      {/* Genre groups — pb-20 so last items clear sticky button */}
      <div class="relative pb-20">
        {/* Alphabet jump strip on the right */}
        <div class="fixed right-0 top-1/2 z-30 flex -translate-y-1/2 flex-col text-[9px] leading-[1.1]">
          {LETTERS.map((l) => {
            const hasLetter = grouped.some(([letter]) => letter === l);
            return (
              <button
                key={l}
                type="button"
                onClick={() => scrollToLetter(l)}
                class={`cursor-pointer px-1 py-0.5 text-center font-medium ${
                  hasLetter
                    ? "text-neutral-700 hover:text-black dark:text-neutral-300 dark:hover:text-white"
                    : "text-neutral-300 dark:text-neutral-700"
                }`}
                disabled={!hasLetter}
              >
                {l}
              </button>
            );
          })}
        </div>

        <div ref={listRef}>
          {grouped.map(([letter, items]) => (
            <div key={letter} id={`genre-${letter}`} class="mb-6">
              <h2 class="sticky top-0 z-10 border-b border-neutral-200 bg-white/80 pb-1 pt-2 text-lg font-bold text-neutral-800 backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-950/80 dark:text-neutral-200">
                {letter}
              </h2>
              <div class="mt-2 flex flex-wrap gap-2">
                {items.map((genre) => (
                  <GenrePill
                    key={genre}
                    name={genre}
                    active={selected.has(genre)}
                    onClick={() => toggle(genre)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Sticky bottom bar — always visible until scrolled past content */}
      <div class="sticky bottom-0 z-20 border-t border-neutral-200 bg-white/80 pb-4 pt-3 text-center backdrop-blur-sm dark:border-neutral-700 dark:bg-neutral-950/80">
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
        <p class="mt-2 text-xs text-neutral-400 dark:text-neutral-500">
          {selected.size === 0
            ? "No genres? We'll show you everything."
            : `${selected.size} selected`}
        </p>
      </div>
    </div>
  );
}
