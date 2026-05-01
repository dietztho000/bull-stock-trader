import { Card, Kpi } from "@/components/ui/Card";
import { LiveAccountKpis } from "@/components/live/LiveAccountKpis";
import { LivePositions } from "@/components/live/LivePositions";
import { LiveOrders } from "@/components/live/LiveOrders";
import { detectAccountInfo } from "@/lib/mode";
import type { AlpacaMode } from "@/lib/alpacaMode";

const COPY: Record<
  AlpacaMode,
  { title: string; envKey: string; envSecret: string; envEndpoint: string; danger: boolean }
> = {
  live: {
    title: "Live account",
    envKey: "ALPACA_API_KEY",
    envSecret: "ALPACA_SECRET_KEY",
    envEndpoint: "ALPACA_ENDPOINT",
    danger: true,
  },
  paper: {
    title: "Paper account",
    envKey: "ALPACA_PAPER_API_KEY",
    envSecret: "ALPACA_PAPER_SECRET_KEY",
    envEndpoint: "ALPACA_PAPER_ENDPOINT",
    danger: false,
  },
};

function EmptyState({
  mode,
  reason,
  detail,
}: {
  mode: AlpacaMode;
  reason: "missing-creds" | "probe-failed";
  detail?: string | null;
}) {
  const c = COPY[mode];
  const headline =
    reason === "missing-creds"
      ? `${c.title} not configured`
      : `${c.title} unreachable`;
  const body =
    reason === "missing-creds"
      ? `Add ${c.envKey} and ${c.envSecret} to .env to enable this view.`
      : `Credentials are set, but the probe call failed. Most often this means the keys don't match the endpoint (e.g. live keys against the paper endpoint, or vice versa). Verify ${c.envKey} / ${c.envSecret} in .env.`;
  return (
    <Card title={c.title}>
      <div className="space-y-2 py-2">
        <div className="text-sm font-medium text-[var(--color-text)]">
          {headline}
        </div>
        <div className="text-xs text-[var(--color-muted)] leading-relaxed">
          {body}
        </div>
        {detail ? (
          <div className="mt-2 text-[11px] font-mono text-[var(--color-muted)] opacity-80 break-all">
            {detail.slice(0, 240)}
          </div>
        ) : null}
      </div>
    </Card>
  );
}

export async function AccountPanel({ mode }: { mode: AlpacaMode }) {
  const probe = await detectAccountInfo(mode);
  const c = COPY[mode];

  if (!probe.configured) {
    return <EmptyState mode={mode} reason="missing-creds" />;
  }
  if (probe.error) {
    return <EmptyState mode={mode} reason="probe-failed" detail={probe.error} />;
  }

  const accentBg = c.danger ? "bg-red-600/10" : "bg-amber-400/10";
  const accentBorder = c.danger ? "border-red-700/40" : "border-amber-500/40";
  const accentText = c.danger ? "text-red-400" : "text-amber-400";

  return (
    <div className="space-y-5">
      <div className={`rounded border ${accentBorder} ${accentBg} px-3 py-2`}>
        <div className={`text-[10px] font-semibold uppercase tracking-wider ${accentText}`}>
          {c.danger ? "Real money" : "Simulated"}
        </div>
        <div className="text-sm font-semibold">{c.title}</div>
        <div className="mt-1 text-[10px] font-mono leading-tight text-[var(--color-muted)]">
          {probe.accountNumber ? <>acct: {probe.accountNumber}</> : null}
          {probe.accountNumber && probe.endpoint ? <br /> : null}
          {probe.endpoint ? (
            <>endpoint: {probe.endpoint.replace(/^https?:\/\//, "")}</>
          ) : null}
        </div>
      </div>

      <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <LiveAccountKpis mode={mode} />
      </section>

      <div className="grid lg:grid-cols-2 gap-5">
        <Card title="Positions" subtitle="Refreshes every 5s from Alpaca">
          <LivePositions mode={mode} />
        </Card>
        <Card title="Open orders" subtitle="Trailing stops, limits, etc.">
          <LiveOrders mode={mode} />
        </Card>
      </div>
    </div>
  );
}
