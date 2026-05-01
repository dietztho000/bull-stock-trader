import Link from "next/link";
import { ModeBadge } from "./ModeBadge";

const links = [
  { href: "/", label: "Overview" },
  { href: "/performance", label: "Performance" },
  { href: "/trades", label: "Trades" },
  { href: "/sectors", label: "Sectors" },
  { href: "/research", label: "Research" },
  { href: "/weekly", label: "Weekly" },
  { href: "/stats", label: "Stats" },
  { href: "/strategy", label: "Strategy" },
];

export async function Nav() {
  return (
    <aside className="w-56 shrink-0 border-r border-[var(--color-border)] min-h-screen px-4 py-6 bg-[var(--color-panel)]">
      <div className="mb-4">
        <div className="text-sm uppercase tracking-wider text-[var(--color-muted)]">
          Bull Stock Trader
        </div>
        <div className="text-base font-semibold">Dashboard</div>
      </div>
      <ModeBadge />
      <nav className="flex flex-col gap-1">
        {links.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="px-3 py-1.5 rounded text-sm text-[var(--color-text)] hover:bg-[var(--color-panel-2)] hover:text-[var(--color-accent)]"
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <div className="mt-8 text-[11px] text-[var(--color-muted)] leading-relaxed">
        Local-only · auto-refresh on memory change
      </div>
    </aside>
  );
}
