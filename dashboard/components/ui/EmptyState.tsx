import type { ReactNode } from "react";
import Link from "next/link";
import { Card } from "./Card";

/** Standardized empty state for tabs/cards that have nothing to show yet.
 *
 *  Each empty state explains *why* the section is empty (so the user can
 *  judge if it's broken or just early in the day) and points at a concrete
 *  next step (a routine that fills it, a settings page to configure, or
 *  a related feature). Audit E.
 *
 *  Usage:
 *    <EmptyState
 *      title="No research yet"
 *      reason="The pre-market routine fills this every morning."
 *      schedule="Next fire ~6 AM CT (Mon–Fri)"
 *      action={{ href: "/bots", label: "Check bot status" }}
 *    />
 */
export function EmptyState({
  title,
  reason,
  schedule,
  action,
  children,
}: {
  title: string;
  /** One-sentence "what fills this" explanation. */
  reason: string;
  /** Optional short schedule hint (e.g. "Fires after market close, ~3:15 PM CT"). */
  schedule?: string;
  /** Optional CTA button — internal link only. */
  action?: { href: string; label: string };
  /** Optional supplementary content rendered below the standard block. */
  children?: ReactNode;
}) {
  return (
    <Card title={title}>
      <div className="space-y-2.5">
        <p className="text-sm text-[var(--color-muted)] leading-relaxed">
          {reason}
        </p>
        {schedule && (
          <p className="text-xs text-[var(--color-muted)] tabular">
            <span className="text-[var(--color-text)]">Next:</span> {schedule}
          </p>
        )}
        {children}
        {action && (
          <div className="pt-1">
            <Link
              href={action.href}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-accent)] hover:underline"
            >
              {action.label}
              <span aria-hidden="true">→</span>
            </Link>
          </div>
        )}
      </div>
    </Card>
  );
}
