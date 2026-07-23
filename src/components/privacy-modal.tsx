import { useEffect, useRef } from "preact/hooks";

interface PrivacyModalProps {
  onClose: () => void;
}

export function PrivacyModal({ onClose }: PrivacyModalProps) {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Prevent body scroll while modal is open
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Close on Escape
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    addEventListener("keydown", handleKey);

    // Focus modal content so keyboard events land here
    contentRef.current?.focus();

    return () => {
      document.body.style.overflow = prev;
      removeEventListener("keydown", handleKey);
    };
  }, [onClose]);

  const handleBackdropClick = (e: MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  };

  return (
    <div
      class="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 pt-16 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div
        ref={contentRef}
        tabIndex={-1}
        class="w-full max-w-2xl border border-neutral-200 bg-white p-6 dark:border-neutral-800 dark:bg-neutral-950"
        role="dialog"
        aria-modal="true"
        aria-label="Privacy Policy"
      >
        <div class="mb-4 flex items-center justify-between">
          <h2 class="text-lg font-bold text-black dark:text-white">Privacy</h2>
          <button
            type="button"
            onClick={onClose}
            class="cursor-pointer text-xl leading-none text-neutral-400 hover:text-black dark:hover:text-white"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        <div class="space-y-4 text-sm text-neutral-700 dark:text-neutral-300">
          <p>
            Bay Noise does not collect, store, or share any personal data.
            There are no accounts, no cookies, and no tracking.
          </p>

          <section>
            <h3 class="mb-1 font-semibold text-black dark:text-white">
              What stays on your device
            </h3>
            <p>
              Your genre preferences are saved in your browser's{" "}
              <code class="break-all text-xs">localStorage</code>. They never
              leave your device and are never sent to any server.
            </p>
          </section>

          <section>
            <h3 class="mb-1 font-semibold text-black dark:text-white">
              Calendar feed
            </h3>
            <p>
              The iCal subscription URL includes your filter choices (genres,
              venues, cities, artists) as query parameters. These are processed
              by a serverless function to generate your personalized feed. The
              parameters are not logged or stored beyond the request.
            </p>
          </section>

          <section>
            <h3 class="mb-1 font-semibold text-black dark:text-white">
              Hosting
            </h3>
            <p>
              This site is hosted on{" "}
              <a
                href="https://www.cloudflare.com/privacypolicy/"
                class="underline underline-offset-2 hover:text-black dark:hover:text-white"
                target="_blank"
                rel="noopener noreferrer"
              >
                Cloudflare Pages
              </a>
              . Like all Cloudflare-served sites, standard edge logs (IP
              address, user agent) may be visible to Cloudflare. We do not
              access or mine these logs.
            </p>
          </section>

          <section>
            <h3 class="mb-1 font-semibold text-black dark:text-white">
              Third-party services
            </h3>
            <p>
              Show data is sourced from the{" "}
              <a
                href="http://www.foopee.com/punk/the-list/"
                class="underline underline-offset-2 hover:text-black dark:hover:text-white"
                target="_blank"
                rel="noopener noreferrer"
              >
                foopee list
              </a>
              . Artist metadata (genres, Spotify links) is fetched from the{" "}
              <a
                href="https://developer.spotify.com/documentation/web-api"
                class="underline underline-offset-2 hover:text-black dark:hover:text-white"
                target="_blank"
                rel="noopener noreferrer"
              >
                Spotify Web API
              </a>{" "}
              during our data pipeline. No user data is ever sent to Spotify.
            </p>
          </section>

          <section>
            <h3 class="mb-1 font-semibold text-black dark:text-white">
              Questions
            </h3>
            <p>
              This project is open source (
              <a
                href="https://github.com/RP2/bay-noise"
                class="underline underline-offset-2 hover:text-black dark:hover:text-white"
                target="_blank"
                rel="noopener noreferrer"
              >
                GitHub
              </a>
              ). Feel free to open an issue or reach out.
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
