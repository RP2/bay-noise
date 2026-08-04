import { useState, useEffect, useRef } from "preact/hooks";

export interface ToastEntry {
  id: number;
  message: string;
}

interface ToastProps {
  toasts: ToastEntry[];
  onDismiss: (id: number) => void;
}

const MAX_VISIBLE = 3;
const DISMISS_MS = 1000;
const FADE_MS = 200;
const PEEK_PX = 8;
const STAGGER_MS = 80;

export function Toast({ toasts, onDismiss }: ToastProps) {
  const visible = toasts.slice(0, MAX_VISIBLE);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="false"
      class="pointer-events-none fixed bottom-[max(1.5rem,env(safe-area-inset-bottom))] right-6 z-40"
    >
      {/* Stack grows upward from the bottom */}
      <div class="relative w-fit">
        {visible.map((toast, i) => (
          <ToastItem
            key={toast.id}
            message={toast.message}
            index={i}
            onDone={() => onDismiss(toast.id)}
          />
        ))}
      </div>
    </div>
  );
}

interface ToastItemProps {
  message: string;
  index: number; // 0 = front (oldest), 1 = behind, 2 = furthest behind
  onDone: () => void;
}

function ToastItem({ message, index, onDone }: ToastItemProps) {
  const [visible, setVisible] = useState(false);
  const [exiting, setExiting] = useState(false);
  const onDoneRef = useRef(onDone);
  const doneRef = useRef(false);
  const dismissedRef = useRef(false);
  const timersRef = useRef<{ outer: ReturnType<typeof setTimeout> | number; inner: ReturnType<typeof setTimeout> | number | null }>({ outer: 0, inner: null });
  const escapeTimersRef = useRef<{ inner: ReturnType<typeof setTimeout> | number | null }>({ inner: null });

  onDoneRef.current = onDone;

  // Staggered fade-in on mount
  useEffect(() => {
    const delay = index * STAGGER_MS;
    const t = setTimeout(() => {
      if (dismissedRef.current) return;
      if (typeof requestAnimationFrame !== "undefined") {
        requestAnimationFrame(() => {
          if (dismissedRef.current) return;
          setVisible(true);
        });
      } else {
        setVisible(true);
      }
    }, delay);
    return () => clearTimeout(t);
  }, []);

  // Auto-dismiss: only start timer when this toast is the front (index 0)
  useEffect(() => {
    if (index !== 0) return;

    const outer = setTimeout(() => {
      setExiting(true);
      const inner = setTimeout(() => {
        if (doneRef.current) return;
        doneRef.current = true;
        onDoneRef.current();
      }, FADE_MS);
      timersRef.current.inner = inner;
    }, DISMISS_MS);
    timersRef.current.outer = outer;

    return () => {
      clearTimeout(timersRef.current.outer);
      if (timersRef.current.inner) clearTimeout(timersRef.current.inner);
    };
  }, [index]);

  // Escape key dismiss
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (doneRef.current) return;
        dismissedRef.current = true;
        clearTimeout(timersRef.current.outer);
        if (escapeTimersRef.current.inner) clearTimeout(escapeTimersRef.current.inner);
        setExiting(true);
        const inner = setTimeout(() => {
          if (doneRef.current) return;
          doneRef.current = true;
          onDoneRef.current();
        }, FADE_MS);
        escapeTimersRef.current.inner = inner;
      }
    };
    addEventListener("keydown", handleKey);
    return () => {
      removeEventListener("keydown", handleKey);
      if (escapeTimersRef.current.inner) clearTimeout(escapeTimersRef.current.inner);
    };
  }, []);

  // Card stack: each card peeks PEEK_PX above the one in front of it.
  // Entrance: slide up from below (translateY(8px) → translateY(stackY))
  // Exit: slide back down to where it came from (translateY(stackY) → translateY(8px))
  const stackY = -(index * PEEK_PX);
  const enterY = exiting ? PEEK_PX : visible ? stackY : PEEK_PX;
  const opacity = exiting ? 0 : visible ? 1 : 0;
  const zIndex = MAX_VISIBLE - index;

  return (
    <div
      class="absolute bottom-0 right-0 w-fit min-w-48 wrap-break-word rounded-sm border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-800 shadow-lg dark:border-neutral-600 dark:bg-neutral-900 dark:text-neutral-200 motion-safe:transition-all motion-safe:duration-200"
      style={{
        transform: `translateY(${enterY}px)`,
        opacity,
        zIndex,
      }}
    >
      {message}
    </div>
  );
}
