interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
}

export function SearchBar({ value, onChange }: SearchBarProps) {
  return (
    <div class="relative flex items-center">
      <svg class="absolute left-3 h-4 w-4 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z" />
      </svg>
      <input
        type="search"
        value={value}
        onInput={(e) => onChange((e.target as HTMLInputElement).value)}
        placeholder="Search artists, venues..."
        aria-label="Search shows"
        class="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-8 text-sm
               placeholder-gray-400 focus:border-blue-500 focus:outline-none
               dark:border-gray-600 dark:bg-gray-800 dark:text-white
               dark:placeholder-gray-500 dark:focus:border-blue-400"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          class="absolute right-2 text-gray-400 hover:text-gray-600
                 dark:text-gray-500 dark:hover:text-gray-300 text-lg leading-none px-1"
          aria-label="Clear search"
        >
          &times;
        </button>
      )}
    </div>
  );
}
