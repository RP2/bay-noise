import { useState, useEffect } from "preact/hooks";

interface FeedSubscribeProps {
  url?: string;
}

export function FeedSubscribe({ url }: FeedSubscribeProps) {
  const icalUrl = url || `${typeof window !== "undefined" ? window.location.origin : ""}/calendar.ics`;
  const [copied, setCopied] = useState(false);
  const [show, setShow] = useState(false);

  // Reset copied state when URL changes
  useEffect(() => {
    setCopied(false);
  }, [url]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(icalUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: offscreen input + execCommand
      const input = document.createElement("input");
      input.value = icalUrl;
      input.style.position = "absolute";
      input.style.left = "-9999px";
      document.body.appendChild(input);
      input.select();
      try {
        document.execCommand("copy");
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // Clipboard unavailable
      } finally {
        document.body.removeChild(input);
      }
    }
  };

  return (
    <div class="text-sm">
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        class="cursor-pointer text-xs underline-offset-2 hover:underline"
      >
        {show ? "Hide iCal" : "Subscribe via iCal"}
      </button>

      {show && (
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
              class={"shrink-0 cursor-pointer border px-2 py-1 text-xs transition-colors " + (copied
                ? "border-green-600 bg-green-50 text-green-700 dark:border-green-500 dark:bg-green-950 dark:text-green-400"
                : "border-neutral-300 bg-white text-neutral-700 hover:bg-black hover:text-white dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-200 dark:hover:bg-white dark:hover:text-black")}
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
