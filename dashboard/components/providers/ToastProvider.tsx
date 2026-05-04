"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";

export type ToastTone = "info" | "success" | "warn" | "error";

export type Toast = {
  id: string;
  tone: ToastTone;
  title: string;
  detail?: string;
  /** ms before auto-dismiss; 0 = sticky. Default: 6000 (errors stay 12000). */
  ttl?: number;
};

type PushInput = Omit<Toast, "id">;

type ToastContextValue = {
  push: (t: PushInput) => string;
  dismiss: (id: string) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

let toastCounter = 0;
const newId = () => `t-${Date.now()}-${++toastCounter}`;

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    setToasts((cur) => cur.filter((t) => t.id !== id));
    const handle = timers.current.get(id);
    if (handle) {
      clearTimeout(handle);
      timers.current.delete(id);
    }
  }, []);

  const push = useCallback(
    (input: PushInput): string => {
      const id = newId();
      const ttl =
        input.ttl ?? (input.tone === "error" ? 12000 : 6000);
      setToasts((cur) => {
        // Cap at 4 simultaneous; drop oldest.
        const next = [...cur, { ...input, id }];
        return next.length > 4 ? next.slice(next.length - 4) : next;
      });
      if (ttl > 0) {
        const handle = setTimeout(() => dismiss(id), ttl);
        timers.current.set(id, handle);
      }
      return id;
    },
    [dismiss]
  );

  useEffect(() => {
    const cleanup = timers.current;
    return () => {
      for (const handle of cleanup.values()) clearTimeout(handle);
      cleanup.clear();
    };
  }, []);

  return (
    <ToastContext.Provider value={{ push, dismiss }}>
      {children}
      <ToastHost toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>");
  }
  return ctx;
}

/** Optional variant for SSR / out-of-tree callers — silently no-op when missing. */
export function useToastOptional(): ToastContextValue | null {
  return useContext(ToastContext);
}

function ToastHost({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div
      className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none"
      role="region"
      aria-label="Notifications"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <motion.div
            key={t.id}
            layout
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24, transition: { duration: 0.18 } }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
            className={clsx(
              "pointer-events-auto glass rounded-2xl px-4 py-3 shadow-lg",
              t.tone === "error" && "glass-tint-down",
              t.tone === "warn" && "glass-tint-warn",
              t.tone === "success" && "glass-tint-up",
              t.tone === "info" && "glass-tint-accent"
            )}
            role={t.tone === "error" ? "alert" : "status"}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold leading-tight">{t.title}</div>
                {t.detail && (
                  <div className="mt-1 text-[11px] text-[var(--color-muted)] break-words">
                    {t.detail}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => onDismiss(t.id)}
                className="text-[var(--color-muted)] hover:text-[var(--color-text)] transition-colors text-xs leading-none px-1"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
