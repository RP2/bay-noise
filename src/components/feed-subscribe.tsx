import { useState, useEffect } from "preact/hooks";

interface FeedSubscribeProps {
  url: string;
  onClose?: () => void;
}

export function FeedSubscribe({ url, onClose }: FeedSubscribeProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setCopied(false);
  }, [url]);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const input = document.createElement("input");
      input.value = url;
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
    <div class="border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-800 dark:bg-neutral-900">
      <div class="mb-1 flex items-center justify-between">
        <p class="text-neutral-600 dark:text-neutral-400">
          Add this URL to your calendar app (Apple Calendar, Google Calendar, etc.):
        </p>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            class="cursor-pointer text-xs text-neutral-400 hover:text-black dark:hover:text-white"
            aria-label="Close"
          >
            &times;
          </button>
        )}
      </div>
      <div class="flex items-center gap-2">
        <code class="flex-1 break-all bg-white px-2 py-1 font-mono text-xs text-neutral-800 dark:bg-neutral-950 dark:text-neutral-200">
          {url}
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
  );
}
