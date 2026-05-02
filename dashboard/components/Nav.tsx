"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, LayoutGroup } from "framer-motion";
import clsx from "clsx";

const links = [
  { href: "/", label: "Overview", icon: OverviewIcon },
  { href: "/trades", label: "Trades", icon: TradesIcon },
  { href: "/analytics", label: "Analytics", icon: AnalyticsIcon },
  { href: "/journal", label: "Journal", icon: JournalIcon },
  { href: "/strategy", label: "Strategy", icon: StrategyIcon },
  { href: "/settings", label: "Settings", icon: SettingsIcon },
];

export function Nav() {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  return (
    <aside className="sticky top-0 h-screen pt-4 pb-4 pl-4 shrink-0 w-56 z-20">
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
                      className="absolute inset-0 rounded-xl glass-tint-accent"
                      transition={{ type: "spring", stiffness: 380, damping: 32 }}
                      style={{ zIndex: 0 }}
                    />
                  )}
                  <Link
                    href={l.href}
                    className={clsx(
                      "relative z-10 flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm font-medium transition-colors",
                      active
                        ? "text-[var(--color-text)]"
                        : "text-[var(--color-muted)] hover:text-[var(--color-text)]"
                    )}
                  >
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{l.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </LayoutGroup>
        <div className="mt-auto pt-4 px-1 text-[10px] text-[var(--color-muted)] leading-relaxed border-t border-[rgba(255,255,255,0.05)]">
          Local-only · auto-refresh on memory change
        </div>
      </nav>
    </aside>
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
