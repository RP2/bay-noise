interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div class="relative flex items-center">
      <svg class="absolute left-3 h-4 w-4 text-neutral-400 dark:text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
      </svg>
      <input
        type="search"
        value={value}
        onInput={(e) => onChange((e.target as HTMLInputElement).value)}
        placeholder="Search artists, venues..."
        aria-label="Search shows"
        class="w-full min-h-11 border border-neutral-300 bg-white px-3 py-2 pl-9 text-sm
               placeholder-neutral-400 focus:border-black focus:outline-none
               dark:border-neutral-600 dark:bg-neutral-900 dark:text-white
               dark:placeholder-neutral-500 dark:focus:border-white"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
           class="absolute right-1 flex h-11 w-11 cursor-pointer items-center justify-center text-lg leading-none text-neutral-400 hover:opacity-60
                  dark:text-neutral-500"
          aria-label="Clear search"
        >
          &times;
        </button>
      )}
    </div>
  );
}
