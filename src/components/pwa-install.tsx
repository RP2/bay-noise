import { useState, useEffect, useRef } from "preact/hooks";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let _deferredPrompt: BeforeInstallPromptEvent | null = null;

if (typeof window !== "undefined") {
  addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    _deferredPrompt = e as BeforeInstallPromptEvent;
  });
}

export function PwaInstall() {
  const [isInstalled, setIsInstalled] = useState(() => {
    if (typeof window === "undefined") return false;
    return matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
  });

  const [dismissed, setDismissed] = useState(false);
  const promptFired = useRef(false);

  useEffect(() => {
    const mql = matchMedia("(display-mode: standalone)");
    const onChange = () => setIsInstalled(mql.matches);
    mql.addEventListener("change", onChange);

    const onInstalled = () => setIsInstalled(true);
    addEventListener("appinstalled", onInstalled);

    return () => {
      mql.removeEventListener("change", onChange);
      removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  if (isInstalled || dismissed) return null;

  const handleInstall = async () => {
    if (!_deferredPrompt) {
      alert(
        "To install Bay Noise:\n\n" +
        "Firefox: Menu → Install (or Add to Home Screen)\n" +
        "Safari on iOS: Share → Add to Home Screen\n" +
        "Chrome: Menu → Install Bay Noise",
      );
      return;
    }

    if (promptFired.current) return;
    promptFired.current = true;

    try {
      await _deferredPrompt.prompt();
      const { outcome } = await _deferredPrompt.userChoice;
      if (outcome === "accepted") {
        setIsInstalled(true);
        _deferredPrompt = null;
      } else {
        setDismissed(true);
      }
    } catch {
      _deferredPrompt = null;
      promptFired.current = false;
    }
  };

  return (
    <button
      type="button"
      onClick={handleInstall}
      aria-label="Install PWA"
      class="cursor-pointer text-xs text-neutral-400 underline-offset-2 hover:underline dark:text-neutral-500 dark:hover:text-white"
    >
      Install PWA
    </button>
  );
}
