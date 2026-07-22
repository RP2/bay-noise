interface GenrePillProps {
  name: string;
  active?: boolean;
  onClick?: () => void;
}

export function GenrePill({ name, active = false, onClick }: GenrePillProps) {
  return (
    <span
      class={`inline-block cursor-pointer select-none px-2.5 py-1 text-sm font-medium transition-colors ${
        active
          ? "bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
          : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 dark:bg-neutral-800 dark:text-neutral-400 dark:hover:bg-neutral-700"
      }`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      aria-pressed={onClick ? active : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
    >
      {name}
    </span>
  );
}
