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
      <summary class="cursor-pointer text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
        Subscribe via iCal
      </summary>
      <div class="mt-2 rounded border border-gray-200 bg-gray-50 p-3 dark:border-gray-700 dark:bg-gray-800">
        <p class="mb-1 text-gray-600 dark:text-gray-400">
          Add this URL to your calendar app (Apple Calendar, Google Calendar, etc.):
        </p>
        <div class="flex items-center gap-2">
          <code class="flex-1 break-all rounded bg-white px-2 py-1 text-xs text-gray-800 dark:bg-gray-900 dark:text-gray-200">
            {icalUrl}
          </code>
          <button
            type="button"
            onClick={copyToClipboard}
            class="shrink-0 rounded bg-gray-200 px-2 py-1 text-xs text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600"
          >
            Copy
          </button>
        </div>
      </div>
    </details>
  );
}
