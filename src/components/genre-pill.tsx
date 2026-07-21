interface GenrePillProps {
  name: string;
  active?: boolean;
  onClick?: () => void;
}

export function GenrePill({ name, active = false, onClick }: GenrePillProps) {
  const base = "inline-block rounded-full px-3 py-1 text-sm font-medium transition-colors cursor-pointer select-none";
  const activeClass = "bg-black text-white dark:bg-white dark:text-black";
  const inactiveClass = "bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700";

  return (
    <span
      class={`${base} ${active ? activeClass : inactiveClass}`}
      onClick={onClick}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onClick(); } } : undefined}
    >
      {name}
    </span>
  );
}
