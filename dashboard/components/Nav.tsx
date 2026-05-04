"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, LayoutGroup } from "framer-motion";
import clsx from "clsx";
import { useEffect, useState } from "react";
import useSWR from "swr";
import { BullMascotNavCard } from "@/components/mascot/BullMascotNavCard";
import { useSettingsOptional } from "@/components/providers/SettingsProvider";

type NavLink = {
  href: string;
  label: string;
  icon: (props: { className?: string }) => React.JSX.Element;
  /** When true, render the "needs attention" red dot — Audit U11. */
  attention?: boolean;
};

const baseLinks: Omit<NavLink, "attention">[] = [
  { href: "/", label: "Overview", icon: OverviewIcon },
  { href: "/glance", label: "Glance", icon: GlanceIcon },
  { href: "/bots", label: "Bots", icon: BotsIcon },
  { href: "/trades", label: "Trades", icon: TradesIcon },
  { href: "/analytics", label: "Analytics", icon: AnalyticsIcon },
  { href: "/journal", label: "Journal", icon: JournalIcon },
  { href: "/calendar", label: "Calendar", icon: CalendarIcon },
  { href: "/strategy", label: "Strategy", icon: StrategyIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

type VaultHealth = {
  usingFallback?: boolean;
  rekeyDrift?: { drifted: boolean };
  rotation?: { overdue?: boolean };
};

const fetcher = (u: string) => fetch(u).then((r) => r.json());

/** Audit U11 — surfaces a single red dot on the Bots nav item when any of
 *  the resolvable-from-/bots conditions is firing: vault on fallback key,
 *  vault rotation overdue, post-rotation drift requiring restart, or any
 *  bot with a sentinel-tripped record. Polls vault health every 60s; bot
 *  state comes from the SettingsProvider so it updates on memory writes
 *  via the existing chokidar watcher. */
function useBotsNeedAttention(): boolean {
  const { data } = useSWR<VaultHealth>("/api/vault/health", fetcher, {
    refreshInterval: 60_000,
    revalidateOnFocus: false,
  });
  const settings = useSettingsOptional();
  const vaultIssue =
    Boolean(data?.usingFallback) ||
    Boolean(data?.rekeyDrift?.drifted) ||
    Boolean(data?.rotation?.overdue);
  const sentinelTripped = (settings?.bots ?? []).some(
    (b) => (b.sentinelTrips ?? []).length > 0
  );
  return vaultIssue || sentinelTripped;
}

export function Nav() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const botsNeedAttention = useBotsNeedAttention();
  const links: NavLink[] = baseLinks.map((l) => ({
    ...l,
    attention: l.href === "/bots" && botsNeedAttention,
  }));

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  // Close on route change.
  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  // Close on Escape.
  useEffect(() => {
    if (!mobileOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMobileOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mobileOpen]);

  const navContent = (
    <nav className="glass rounded-2xl h-full p-3 flex flex-col">
      <LayoutGroup id="primary-nav">
        <ul className="flex flex-col gap-1">
          {links.map((l) => {
            const active = isActive(l.href);
            const Icon = l.icon;
            return (
              <li key={l.href} className="relative">
                {active && (
                  <motion.span
                    layoutId="nav-active"
                    className="absolute inset-0 rounded-xl glass-tint-accent pointer-events-none"
                    transition={{ type: "spring", stiffness: 380, damping: 32 }}
                    style={{ zIndex: 0 }}
                    aria-hidden="true"
                  />
                )}
                <Link
                  href={l.href}
                  prefetch={false}
                  className={clsx(
                    "relative z-10 flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors",
                    active
                      ? "text-[var(--color-text)]"
                      : "text-[var(--color-muted)] hover:text-[var(--color-text)]"
                  )}
                >
                  <span className="relative">
                    <Icon className="w-4 h-4 shrink-0" />
                    {l.attention && (
                      <span
                        className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-[var(--color-down)] ring-2 ring-[var(--bg)] motion-safe:animate-pulse"
                        aria-label="needs attention"
                      />
                    )}
                  </span>
                  <span>{l.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </LayoutGroup>
      <BullMascotNavCard className="mt-auto" />
      <div className="pt-3 px-1 text-[10px] text-[var(--color-muted)] leading-relaxed border-t border-[rgba(255,255,255,0.05)]">
        Local-only · auto-refresh on memory change
      </div>
    </nav>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="md:hidden fixed top-3 left-3 z-30 glass rounded-full w-9 h-9 flex items-center justify-center"
        aria-label="Open navigation"
      >
        <svg viewBox="0 0 16 16" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round">
          <line x1="2" y1="4" x2="14" y2="4" />
          <line x1="2" y1="8" x2="14" y2="8" />
          <line x1="2" y1="12" x2="14" y2="12" />
        </svg>
      </button>
      {/* Desktop: sticky sidebar. */}
      <aside className="hidden md:block sticky top-0 h-screen pt-4 pb-4 pl-4 shrink-0 w-56 z-20">
        {navContent}
      </aside>
      {/* Mobile: slide-in sheet. */}
      {mobileOpen && (
        <div
          className="md:hidden fixed inset-0 z-40 flex"
          onClick={() => setMobileOpen(false)}
        >
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            aria-hidden="true"
          />
          <div
            className="relative w-64 h-full p-3 z-50"
            onClick={(e) => e.stopPropagation()}
          >
            {navContent}
          </div>
        </div>
      )}
    </>
  );
}

function OverviewIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="5" height="6" rx="1" />
      <rect x="9" y="2" width="5" height="3" rx="1" />
      <rect x="9" y="7" width="5" height="7" rx="1" />
      <rect x="2" y="10" width="5" height="4" rx="1" />
    </svg>
  );
}
function GlanceIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="2" width="10" height="12" rx="2" />
      <line x1="6" y1="13" x2="10" y2="13" />
      <line x1="6" y1="5" x2="10" y2="5" />
      <line x1="6" y1="8" x2="10" y2="8" />
    </svg>
  );
}
function BotsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="5" width="10" height="8" rx="1.5" />
      <line x1="8" y1="2" x2="8" y2="5" />
      <circle cx="6" cy="9" r="1" fill="currentColor" />
      <circle cx="10" cy="9" r="1" fill="currentColor" />
    </svg>
  );
}
function TradesIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12 L6 8 L9 10 L14 4" />
      <path d="M10 4 L14 4 L14 8" />
    </svg>
  );
}
function AnalyticsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <line x1="2" y1="14" x2="14" y2="14" />
      <rect x="3" y="8" width="2" height="6" />
      <rect x="7" y="5" width="2" height="9" />
      <rect x="11" y="2" width="2" height="12" />
    </svg>
  );
}
function JournalIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 2 L13 2 L13 14 L3 14 Z" />
      <line x1="6" y1="5" x2="11" y2="5" />
      <line x1="6" y1="8" x2="11" y2="8" />
      <line x1="6" y1="11" x2="9" y2="11" />
    </svg>
  );
}
function CalendarIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="12" height="11" rx="1.5" />
      <line x1="2" y1="6.5" x2="14" y2="6.5" />
      <line x1="5" y1="2" x2="5" y2="4.5" />
      <line x1="11" y1="2" x2="11" y2="4.5" />
    </svg>
  );
}
function StrategyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="6" />
      <circle cx="8" cy="8" r="3" />
      <circle cx="8" cy="8" r="1" fill="currentColor" />
    </svg>
  );
}
function SettingsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="8" cy="8" r="2.5" />
      <path d="M8 1.5 V3 M8 13 V14.5 M14.5 8 H13 M3 8 H1.5 M12.6 3.4 L11.5 4.5 M4.5 11.5 L3.4 12.6 M12.6 12.6 L11.5 11.5 M4.5 4.5 L3.4 3.4" />
    </svg>
  );
}
