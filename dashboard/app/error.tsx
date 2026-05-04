"use client";

import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[dashboard] uncaught render error", error);
  }, [error]);

  const detail = error.message || "An unknown error occurred.";

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-6">
      <div className="frost rounded-3xl p-8 max-w-lg w-full">
        <div className="text-[10px] uppercase tracking-[0.18em] text-[var(--color-down)] font-semibold mb-2">
          Dashboard error
        </div>
        <div className="text-2xl font-semibold leading-tight mb-3">
          Something broke while rendering this view.
        </div>
        <p className="text-sm text-[var(--color-muted)] leading-relaxed mb-4">
          The error has been logged to the browser console. Your trading data
          on Alpaca is unaffected — this is a UI-only failure.
        </p>
        <pre className="text-[11px] tabular text-[var(--color-down)] bg-[rgba(255,255,255,0.04)] rounded-lg p-3 mb-4 whitespace-pre-wrap break-all max-h-48 overflow-y-auto">
          {detail}
          {error.digest ? `\n\ndigest: ${error.digest}` : ""}
        </pre>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={reset}
            className="glass glass-interactive glass-tint-accent rounded-full px-4 py-1.5 text-xs font-semibold"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.assign("/")}
            className="glass glass-interactive rounded-full px-4 py-1.5 text-xs font-semibold"
          >
            Go to Overview
          </button>
        </div>
      </div>
    </div>
  );
}
