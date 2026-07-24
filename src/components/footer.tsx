export function Footer() {
  return (
    <footer>
      <div class="mx-auto border-t border-neutral-200 py-6 px-4 text-center text-xs text-neutral-400 dark:border-neutral-800 dark:text-neutral-500">
        <nav aria-label="Site links">
          <a
            href="https://github.com/RP2/bay-noise"
            class="underline-offset-2 hover:underline dark:hover:text-white"
            target="_blank"
            rel="noopener noreferrer"
          >
            GitHub
          </a>
          <span
            aria-hidden="true"
            class="mx-2 text-neutral-300 dark:text-neutral-600"
          >
            ·
          </span>
          <a
            href="https://www.foopee.com/punk/the-list/"
            class="underline-offset-2 hover:underline dark:hover:text-white"
            target="_blank"
            rel="noopener noreferrer"
          >
            Foopee
          </a>
          <span
            aria-hidden="true"
            class="mx-2 text-neutral-300 dark:text-neutral-600"
          >
            ·
          </span>
          <a
            href="https://rileyperalta.com"
            class="underline-offset-2 hover:underline dark:hover:text-white"
            target="_blank"
            rel="me"
          >
            Riley Peralta
          </a>
        </nav>
      </div>
    </footer>
  );
}
