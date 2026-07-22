export function FeedSubscribe() {
  const icalUrl = `${window.location.origin}/calendar.ics`;

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(icalUrl);
    } catch {
      // Fallback: select the text manually
      const input = document.createElement("input");
      input.value = icalUrl;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }
  };

  return (
    <details class="group text-sm">
      <summary class="cursor-pointer text-xs text-neutral-500 hover:text-black dark:text-neutral-400 dark:hover:text-white">
        Subscribe via iCal
      </summary>
      <div class="mt-2 border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
        <p class="mb-1 text-neutral-600 dark:text-neutral-400">
          Add this URL to your calendar app (Apple Calendar, Google Calendar, etc.):
        </p>
        <div class="flex items-center gap-2">
          <code class="flex-1 break-all bg-white px-2 py-1 font-mono text-xs text-neutral-800 dark:bg-neutral-950 dark:text-neutral-200">
            {icalUrl}
          </code>
          <button
            type="button"
            onClick={copyToClipboard}
             class="shrink-0 cursor-pointer border border-neutral-300 bg-white px-2 py-1 text-xs text-neutral-700 hover:bg-black hover:text-white dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-white dark:hover:text-black"
          >
            Copy
          </button>
        </div>
      </div>
    </details>
  );
}
