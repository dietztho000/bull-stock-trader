import { Card } from "@/components/ui/Card";
import { DrawdownBreaker } from "@/components/live/DrawdownBreaker";
import { detectAccountInfo, detectAccountInfoById } from "@/lib/mode";
import type { AlpacaMode } from "@/lib/alpacaMode";

const COPY: Record<
  AlpacaMode,
  { titleSuffix: string; envKey: string; envSecret: string; danger: boolean }
> = {
  live: {
    titleSuffix: "Live account",
    envKey: "ALPACA_API_KEY",
    envSecret: "ALPACA_SECRET_KEY",
    danger: true,
  },
  paper: {
    titleSuffix: "Paper account",
    envKey: "ALPACA_PAPER_API_KEY",
    envSecret: "ALPACA_PAPER_SECRET_KEY",
    danger: false,
  },
};

export async function AccountIdentityTile({
  mode,
  accountId,
  accountLabel,
  botId,
}: {
  mode: AlpacaMode;
  accountId?: string | null;
  accountLabel?: string | null;
  botId?: string | null;
}) {
  // Prefer the multi-account probe when we have an accountId — picks the
  // right account_number on installs with multiple paper accounts (audit A2).
  // Fall back to the legacy env probe only when no registry binding exists.
  const probe = accountId
    ? await detectAccountInfoById(accountId)
    : await detectAccountInfo(mode);
  const c = COPY[mode];
  const cardTitle = accountLabel ?? c.titleSuffix;

  if (!probe.configured) {
    return (
      <Card title={cardTitle}>
        <div className="space-y-2 py-2">
          <div className="text-sm font-medium text-[var(--color-text)]">
            {cardTitle} not configured
          </div>
          <div className="text-xs text-[var(--color-muted)] leading-relaxed">
            {accountId ? (
              <>Account credentials missing — re-add via /bots.</>
            ) : (
              <>Add {c.envKey} and {c.envSecret} to .env to enable this view.</>
            )}
          </div>
        </div>
      </Card>
    );
  }
  if (probe.error) {
    return (
      <Card title={cardTitle}>
        <div className="space-y-2 py-2">
          <div className="text-sm font-medium text-[var(--color-text)]">
            {cardTitle} unreachable
          </div>
          <div className="text-xs text-[var(--color-muted)] leading-relaxed">
            Credentials are set, but the probe call failed. Most often this
            means the keys don&apos;t match the endpoint.
            {accountId ? (
              <> Verify in /bots → Test.</>
            ) : (
              <> Verify {c.envKey} / {c.envSecret} in .env.</>
            )}
          </div>
          <div className="mt-2 text-[11px] font-mono text-[var(--color-muted)] opacity-80 break-all">
            {probe.error.slice(0, 240)}
          </div>
        </div>
      </Card>
    );
  }

  const accentBg = c.danger ? "bg-red-600/10" : "bg-amber-400/10";
  const accentBorder = c.danger ? "border-red-700/40" : "border-amber-500/40";
  const accentText = c.danger ? "text-red-400" : "text-amber-400";

  return (
    <div className="space-y-3">
      <div className={`rounded border ${accentBorder} ${accentBg} px-3 py-2`}>
        <div
          className={`text-[10px] font-semibold uppercase tracking-wider ${accentText}`}
        >
          {c.danger ? "Real money" : "Simulated"}
        </div>
        <div className="text-sm font-semibold">{cardTitle}</div>
        {botId && botId !== accountId && (
          <div className="text-[10px] text-[var(--color-muted)]">
            bot: {botId}
          </div>
        )}
        <div className="mt-1 text-[10px] font-mono leading-tight text-[var(--color-muted)]">
          {probe.accountNumber ? <>acct: {probe.accountNumber}</> : null}
          {probe.accountNumber && probe.endpoint ? <br /> : null}
          {probe.endpoint ? (
            <>endpoint: {probe.endpoint.replace(/^https?:\/\//, "")}</>
          ) : null}
        </div>
      </div>
      <DrawdownBreaker mode={mode} accountId={accountId ?? null} botId={botId ?? null} />
    </div>
  );
}
