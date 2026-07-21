import { generateSingleIcs } from "../lib/ics.js";
import type { VenueEvent } from "../lib/types.js";

interface AddToCalendarProps {
  date: string;
  venue: VenueEvent;
}

/** Sanitize a string for use in a filename. */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export function AddToCalendar({ date, venue }: AddToCalendarProps) {
  const slug = slugify(venue.name) || "event";
  const filename = `${date}-${slug}.ics`;

  const handleDownload = () => {
    const ics = generateSingleIcs(date, venue);
    const blob = new Blob([ics], { type: "text/calendar;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <button
      type="button"
      onClick={handleDownload}
      class="text-sm text-blue-600 underline hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-200"
    >
      + Add to Calendar
    </button>
  );
}
