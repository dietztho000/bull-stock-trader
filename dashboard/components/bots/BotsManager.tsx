"use client";

import useSWR, { mutate } from "swr";
import { useState } from "react";
import clsx from "clsx";
import { Card, Badge } from "@/components/ui/Card";
import { fmtMoney, fmtRelativeTime, fmtSignedMoney } from "@/lib/format";
import type { Bot, RedactedAccount } from "@/lib/settings";
import { VaultKeyBanner } from "./VaultKeyBanner";
import { BotsLeaderboard } from "./BotsLeaderboard";
import { LaunchdStatusTile } from "./LaunchdStatusTile";
import { PromoteModal } from "./PromoteModal";
import { RollbackButton } from "./RollbackButton";
import { AllocationBar, type AllocationSlice } from "./AllocationBar";
import { HealthDot } from "./HealthDot";
import { DiscordTestButton } from "./DiscordTestButton";
import { RotateAccountCredsModal } from "./RotateAccountCredsModal";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const ACCOUNTS_URL = "/api/accounts";
// includeDisabled=true so the admin page can still see disabled bots and
// re-enable them. The unscoped /api/bots default filters to enabled-only.
const BOTS_URL = "/api/bots?includeDisabled=true";

const ENDPOINT_DEFAULTS: Record<"live" | "paper", string> = {
  live: "https://api.alpaca.markets/v2",
  paper: "https://paper-api.alpaca.markets/v2",
};

type SentinelTripRecord = NonNullable<Bot["sentinelTrips"]>[number];

function tripSummary(trip: SentinelTripRecord): string {
  const ago = `${fmtRelativeTime(Date.parse(trip.trippedAt))} ago`;
  if (trip.reason === "healthcheck-failure") {
    return `Auto-disabled ${ago} — ${trip.cap} consecutive Alpaca healthcheck failures. Likely a revoked key.`;
  }
  return `Sentinel tripped ${ago} — ${trip.cap} consecutive losses (${trip.symbols.join(", ")}).`;
}

function tripTooltip(trip: SentinelTripRecord): string {
  const base = tripSummary(trip);
  return trip.detail ? `${base} Last error: ${trip.detail}` : base;
}

export function BotsManager() {
  const accountsResp = useSWR<{ accounts: RedactedAccount[] }>(ACCOUNTS_URL, fetcher);
  const botsResp = useSWR<{ bots: Bot[] }>(BOTS_URL, fetcher);

  const accounts = accountsResp.data?.accounts ?? [];
  const bots = botsResp.data?.bots ?? [];
  const loading = accountsResp.isLoading || botsResp.isLoading;

  const [showAccountForm, setShowAccountForm] = useState(false);
  const [showBotForm, setShowBotForm] = useState(false);
  const [editingBot, setEditingBot] = useState<Bot | null>(null);
  const [promotingBot, setPromotingBot] = useState<Bot | null>(null);
  const [rotatingAccount, setRotatingAccount] = useState<RedactedAccount | null>(null);

  const noAccounts = !loading && accounts.length === 0;
  const hasLiveBot = bots.some((b) => {
    const acct = accounts.find((a) => a.id === b.accountId);
    return acct?.mode === "live";
  });

  return (
    <div className="space-y-6">
      <VaultKeyBanner />

      <header className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Bots</h1>
          <p className="text-xs text-[var(--color-muted)] mt-0.5">
            Each bot is a named trading agent bound to an Alpaca account.
            Multiple bots can share one paper account by carving its capital
            into soft allocations.
          </p>
        </div>
      </header>

      {noAccounts ? (
        <NoAccountsEmptyState onAdd={() => setShowAccountForm(true)} />
      ) : (
        <>
          {bots.length > 1 && <BotsLeaderboard />}

          <LaunchdStatusTile />

          <Card
            title="Accounts"
            subtitle={`${accounts.length} configured`}
            right={
              <button
                type="button"
                onClick={() => setShowAccountForm(true)}
                className="glass rounded-full px-3 py-1.5 text-xs font-semibold hover:opacity-90"
              >
                + New account
              </button>
            }
          >
            {loading ? (
              <div className="text-xs text-[var(--color-muted)]">Loading…</div>
            ) : (
              <div className="space-y-2">
                {accounts.map((a) => (
                  <AccountRow key={a.id} account={a} bots={bots} />
                ))}
              </div>
            )}
          </Card>

          <Card
            title="Bots"
            subtitle={`${bots.length} configured`}
            right={
              <button
                type="button"
                onClick={() => setShowBotForm(true)}
                disabled={accounts.length === 0}
                className="glass rounded-full px-3 py-1.5 text-xs font-semibold hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
                title={accounts.length === 0 ? "Add an account first" : undefined}
              >
                + New bot
              </button>
            }
          >
            {loading ? (
              <div className="text-xs text-[var(--color-muted)]">Loading…</div>
            ) : bots.length === 0 ? (
              <div className="text-xs text-[var(--color-muted)]">
                No bots yet. Each bot binds to an account and (optionally) takes a
                slice of its capital.
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {bots.map((b) => {
                  const acct = accounts.find((a) => a.id === b.accountId);
                  const promotable = acct?.mode === "paper" && hasLiveBot;
                  return (
                    <BotCard
                      key={b.id}
                      bot={b}
                      account={acct}
                      onEdit={() => setEditingBot(b)}
                      onPromote={promotable ? () => setPromotingBot(b) : null}
                      onRotateCreds={
                        acct ? () => setRotatingAccount(acct) : undefined
                      }
                    />
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}

      {showAccountForm && (
        <AccountForm onClose={() => setShowAccountForm(false)} />
      )}
      {showBotForm && (
        <BotForm
          accounts={accounts}
          existingBots={bots}
          onClose={() => setShowBotForm(false)}
        />
      )}
      {editingBot && (
        <EditBotForm
          bot={editingBot}
          accounts={accounts}
          existingBots={bots}
          onClose={() => setEditingBot(null)}
        />
      )}
      {promotingBot && (
        <PromoteModal
          source={promotingBot}
          bots={bots}
          accounts={accounts}
          onClose={() => setPromotingBot(null)}
          onSuccess={() => {
            // Don't auto-close — the SuccessView gives the user the
            // commit instructions, then they hit Done.
          }}
        />
      )}
      {rotatingAccount && (
        <RotateAccountCredsModal
          account={rotatingAccount}
          onClose={() => setRotatingAccount(null)}
        />
      )}
    </div>
  );
}

// ─── Empty state when zero accounts ──────────────────────────────────

function NoAccountsEmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="frost rounded-2xl p-8 text-center max-w-xl mx-auto">
      <div className="text-3xl mb-2">🤖</div>
      <h2 className="text-base font-semibold mb-1">No Alpaca accounts yet</h2>
      <p className="text-xs text-[var(--color-muted)] leading-relaxed mb-4">
        Add an Alpaca paper account to get started. You&apos;ll be able to spin
        up bots that share its capital, or carve $ slices for parallel
        strategies. Credentials are encrypted at rest via{" "}
        <code className="font-mono">BULL_VAULT_KEY</code>.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="glass glass-tint-up rounded-full px-4 py-2 text-sm font-semibold hover:opacity-90"
      >
        + Add your first account
      </button>
      <div className="mt-4 text-[10px] text-[var(--color-muted)]">
        Don&apos;t have one yet?{" "}
        <a
          href="https://alpaca.markets/"
          target="_blank"
          rel="noopener noreferrer"
          className="text-[var(--color-accent)] hover:underline"
        >
          alpaca.markets
        </a>{" "}
        — paper trading is free.
      </div>
    </div>
  );
}

// ─── Account row + delete ─────────────────────────────────────────────

function AccountRow({ account, bots }: { account: RedactedAccount; bots: Bot[] }) {
  const boundBots = bots.filter((b) => b.accountId === account.id);
  const allocated = boundBots.reduce((sum, b) => sum + (b.allocation ?? 0), 0);
  const total = account.totalCapital;
  const free = total != null ? total - allocated : null;

  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function doDelete() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`${ACCOUNTS_URL}/${encodeURIComponent(account.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? `Delete failed: HTTP ${res.status}`);
        return;
      }
      setConfirming(false);
      mutate(ACCOUNTS_URL);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex items-center justify-between gap-3 rounded-xl border border-[rgba(255,255,255,0.05)] p-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold truncate">{account.label}</span>
            <Badge tone={account.mode === "live" ? "down" : "warn"}>{account.mode}</Badge>
            <span className="text-[10px] text-[var(--color-muted)] font-mono">
              {account.apiKeyHint ?? "—"}
            </span>
          </div>
          <div className="text-[11px] text-[var(--color-muted)] mt-0.5">
            {boundBots.length} bot{boundBots.length === 1 ? "" : "s"}
            {total != null && (
              <>
                {" · "}
                {fmtMoney(allocated)} / {fmtMoney(total)} allocated
                {free != null && free < 0 && (
                  <span className="text-[var(--color-down)]"> (over by {fmtMoney(-free)})</span>
                )}
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={() => setConfirming(true)}
          className="text-[11px] text-[var(--color-muted)] hover:text-[var(--color-down)] underline-offset-2 hover:underline"
        >
          Delete
        </button>
      </div>
      {confirming && (
        <ConfirmDialog
          title={`Delete account "${account.label}"?`}
          confirmLabel="Delete account"
          destructive
          busy={busy}
          error={error}
          onConfirm={doDelete}
          onCancel={() => {
            setConfirming(false);
            setError(null);
          }}
        >
          <p>
            This removes the account from settings.json and detaches it from
            any bots that reference it. <strong>This cannot be undone.</strong>
          </p>
          {boundBots.length > 0 && (
            <p className="text-[var(--color-warn)] mt-2">
              ⚠ {boundBots.length} bot{boundBots.length === 1 ? "" : "s"}{" "}
              currently bound to this account will reject orders until rebound.
            </p>
          )}
        </ConfirmDialog>
      )}
    </>
  );
}

// ─── Bot card with live equity ────────────────────────────────────────

type BotEquityResp = {
  equity?: {
    equity: number;
    cash: number;
    deployed: number;
    unrealizedPl: number;
    isVirtual: boolean;
  };
  error?: string;
};

function BotCard({
  bot,
  account,
  onEdit,
  onPromote,
  onRotateCreds,
}: {
  bot: Bot;
  account: RedactedAccount | undefined;
  onEdit: () => void;
  /** When non-null, surfaces a "Promote → live" button on the card.
   *  Set by the parent only for paper bots when at least one live target
   *  exists (otherwise the modal would have nothing to promote into). */
  onPromote: (() => void) | null;
  /** Click-to-fix handler invoked when the HealthDot is in its failed
   *  state (follow-up #3). Opens the parent's credential-rotation modal
   *  scoped to this bot's account. */
  onRotateCreds?: () => void;
}) {
  const equity = useSWR<BotEquityResp>(
    `${BOTS_URL}/${encodeURIComponent(bot.id)}/equity`,
    fetcher,
    { refreshInterval: 30_000 }
  );
  const e = equity.data?.equity;

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toggleError, setToggleError] = useState<string | null>(null);

  async function doDelete() {
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`${BOTS_URL}/${encodeURIComponent(bot.id)}`, { method: "DELETE" });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setDeleteError(body.error ?? `Delete failed: HTTP ${res.status}`);
        return;
      }
      setConfirmingDelete(false);
      mutate(BOTS_URL);
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  }

  async function onToggle() {
    setToggleError(null);
    const res = await fetch(`${BOTS_URL}/${encodeURIComponent(bot.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ enabled: !bot.enabled }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setToggleError(body.error ?? `Toggle failed: HTTP ${res.status}`);
      // Auto-clear after a bit so the error doesn't stick.
      setTimeout(() => setToggleError(null), 4000);
      return;
    }
    mutate(BOTS_URL);
  }

  // Audit F5 — when the bot is disabled AND the most recent sentinel trip is
  // recent (within 24h), show "auto-disabled" instead of plain "disabled" so
  // the user can tell at a glance why the bot is off.
  const lastTrip = (bot.sentinelTrips ?? []).at(-1) ?? null;
  const trippedRecently =
    !bot.enabled &&
    lastTrip != null &&
    Date.now() - Date.parse(lastTrip.trippedAt) < 24 * 60 * 60 * 1000;

  // Audit U4 — left-border tint by account mode so a row of bot cards reads
  // live-vs-paper at a glance without scanning each card's badge.
  const modeBorder =
    account?.mode === "live"
      ? "border-l-2 border-l-[var(--color-down)]"
      : account?.mode === "paper"
      ? "border-l-2 border-l-[var(--color-warn)]"
      : "";

  return (
    <div
      className={clsx(
        "rounded-xl border border-[rgba(255,255,255,0.05)] p-3 space-y-2.5",
        modeBorder
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <HealthDot botId={bot.id} onClickFailed={onRotateCreds} />
            <span className="text-sm font-semibold truncate">{bot.name}</span>
            {!bot.enabled &&
              (trippedRecently && lastTrip ? (
                <span title={tripTooltip(lastTrip)}>
                  <Badge tone="down">auto-disabled</Badge>
                </span>
              ) : (
                <Badge tone="warn">disabled</Badge>
              ))}
            {account && (
              <Badge tone={account.mode === "live" ? "down" : "warn"}>{account.mode}</Badge>
            )}
          </div>
          <div className="text-[10px] text-[var(--color-muted)] mt-0.5 font-mono">
            id: {bot.id} · acct: {account?.label ?? bot.accountId}
            {bot.allocation != null && <> · {fmtMoney(bot.allocation)} allocated</>}
          </div>
          {trippedRecently && lastTrip && (
            <div className="text-[10px] text-[var(--color-down)] mt-1 leading-relaxed">
              {tripSummary(lastTrip)}
            </div>
          )}
        </div>
      </div>
      {equity.error || equity.data?.error ? (
        <div className="text-[11px] text-[var(--color-down)] break-all">
          {equity.data?.error ?? String(equity.error)}
        </div>
      ) : !e ? (
        <div className="text-[11px] text-[var(--color-muted)]">Loading equity…</div>
      ) : (
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)]">
              {e.isVirtual ? "Virtual eq" : "Equity"}
            </div>
            <div className="text-sm font-semibold tabular">{fmtMoney(e.equity)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)]">
              Cash
            </div>
            <div className="text-sm font-semibold tabular">{fmtMoney(e.cash)}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)]">
              Unrealized
            </div>
            <div className="text-sm font-semibold tabular">{fmtSignedMoney(e.unrealizedPl)}</div>
          </div>
        </div>
      )}
      <div className="flex items-center justify-between pt-2 border-t border-[rgba(255,255,255,0.05)]">
        <div className="flex gap-3">
          <a
            href={`/?bot=${encodeURIComponent(bot.id)}`}
            className="text-[11px] text-[var(--color-accent)] hover:underline"
          >
            Overview →
          </a>
          <a
            href={`/trades?bot=${encodeURIComponent(bot.id)}`}
            className="text-[11px] text-[var(--color-accent)] hover:underline"
          >
            Trades →
          </a>
        </div>
        <div className="flex gap-3">
          {onPromote && (
            <button
              type="button"
              onClick={onPromote}
              className="text-[11px] text-[var(--color-accent)] hover:underline"
              title="Copy this bot's TRADING-STRATEGY.md to a live bot"
            >
              Promote →
            </button>
          )}
          <RollbackButton botId={bot.id} />
          <DiscordTestButton botId={bot.id} />
          <button
            type="button"
            onClick={onEdit}
            className="text-[11px] text-[var(--color-muted)] hover:text-[var(--color-text)]"
          >
            Edit
          </button>
          <button
            type="button"
            onClick={onToggle}
            className="text-[11px] text-[var(--color-muted)] hover:text-[var(--color-text)]"
          >
            {bot.enabled ? "Disable" : "Enable"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            className="text-[11px] text-[var(--color-muted)] hover:text-[var(--color-down)]"
          >
            Delete
          </button>
        </div>
      </div>
      {toggleError && (
        <div className="text-[11px] text-[var(--color-down)] break-all">
          {toggleError}
        </div>
      )}
      {confirmingDelete && (
        <ConfirmDialog
          title={`Delete bot "${bot.name}"?`}
          confirmLabel="Delete bot"
          destructive
          busy={deleting}
          error={deleteError}
          onConfirm={doDelete}
          onCancel={() => {
            setConfirmingDelete(false);
            setDeleteError(null);
          }}
        >
          <p>
            Removes the bot from settings.json. Memory under{" "}
            <code className="font-mono">memory/{bot.id}/</code> stays on disk —
            you can manually delete it or recreate the bot to reuse it.
          </p>
          {bot.allocation != null && (
            <p className="text-[var(--color-warn)] mt-2">
              ⚠ {fmtMoney(bot.allocation)} of soft allocation will be released
              back to the account.
            </p>
          )}
        </ConfirmDialog>
      )}
    </div>
  );
}

// ─── New account modal ───────────────────────────────────────────────

function AccountForm({ onClose }: { onClose: () => void }) {
  const [id, setId] = useState("");
  const [label, setLabel] = useState("");
  const [mode, setMode] = useState<"live" | "paper">("paper");
  const [endpoint, setEndpoint] = useState(ENDPOINT_DEFAULTS.paper);
  const [apiKey, setApiKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [totalCapital, setTotalCapital] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [savedSnippet, setSavedSnippet] = useState<{
    namespace: string;
    apiKey: string;
    secretKey: string;
    endpoint: string;
  } | null>(null);

  function setModeAndDefault(next: "live" | "paper") {
    setMode(next);
    setEndpoint(ENDPOINT_DEFAULTS[next]);
  }

  async function onTest() {
    setBusy(true);
    setError(null);
    setTestResult(null);
    try {
      const res = await fetch("/api/accounts/__test__/test", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ endpoint, apiKey, secretKey }),
      });
      const body = await res.json();
      if (body.ok) {
        setTestResult(`✓ Reached Alpaca — account ${body.accountNumber ?? "(no #)"}`);
      } else {
        setError(body.error ?? "Test failed");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(ACCOUNTS_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id,
          label,
          mode,
          endpoint,
          apiKey,
          secretKey,
          totalCapital: totalCapital ? Number(totalCapital) : undefined,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      mutate(ACCOUNTS_URL);
      // Don't close yet — surface the env-var snippet the user needs to
      // paste into Claude Code so cloud routines can resolve these creds.
      setSavedSnippet({
        namespace: id.toUpperCase().replace(/-/g, "_"),
        apiKey,
        secretKey,
        endpoint,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (savedSnippet) {
    return (
      <Modal onClose={onClose} title={`✓ Account "${id}" saved`}>
        <SavedSnippetView snippet={savedSnippet} onDone={onClose} />
      </Modal>
    );
  }

  return (
    <Modal onClose={onClose} title="New Alpaca account">
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Account id (slug)" hint="Lowercase, hyphens. Used in URLs.">
          <input
            required
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="paper-100k"
            className={inputClass}
          />
        </Field>
        <Field label="Label">
          <input
            required
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Paper $100k sandbox"
            className={inputClass}
          />
        </Field>
        <Field label="Mode">
          <div className="flex gap-2">
            {(["paper", "live"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setModeAndDefault(m)}
                className={`glass rounded-full px-3 py-1.5 text-xs font-semibold ${
                  mode === m ? "ring-1 ring-[var(--color-accent)]" : "opacity-60"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Endpoint">
          <input
            required
            value={endpoint}
            onChange={(e) => setEndpoint(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="API key">
          <input
            required
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            type="password"
            autoComplete="off"
            className={inputClass}
          />
        </Field>
        <Field label="Secret key">
          <input
            required
            value={secretKey}
            onChange={(e) => setSecretKey(e.target.value)}
            type="password"
            autoComplete="off"
            className={inputClass}
          />
        </Field>
        <Field label="Total capital ($, optional)" hint="Used by the allocation UI to show free vs allocated.">
          <input
            value={totalCapital}
            onChange={(e) => setTotalCapital(e.target.value)}
            type="number"
            min="0"
            step="any"
            placeholder="100000"
            className={inputClass}
          />
        </Field>

        {testResult && (
          <div className="text-xs text-[var(--color-up)]">{testResult}</div>
        )}
        {error && <div className="text-xs text-[var(--color-down)]">{error}</div>}

        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={onTest}
            disabled={busy || !apiKey || !secretKey}
            className="text-xs underline underline-offset-2 disabled:opacity-50"
          >
            Test connection
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="glass rounded-full px-3 py-1.5 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="glass glass-tint-up rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
            >
              {busy ? "Saving…" : "Save account"}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}

// ─── Post-save: env-var snippet for Claude Code routines ─────────────

function SavedSnippetView({
  snippet,
  onDone,
}: {
  snippet: { namespace: string; apiKey: string; secretKey: string; endpoint: string };
  onDone: () => void;
}) {
  const lines = [
    `ALPACA_${snippet.namespace}_API_KEY=${snippet.apiKey}`,
    `ALPACA_${snippet.namespace}_SECRET_KEY=${snippet.secretKey}`,
    `ALPACA_${snippet.namespace}_ENDPOINT=${snippet.endpoint}`,
  ].join("\n");
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(lines);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      // older browser / permission denied — leave the textarea so users can copy manually
    }
  }
  return (
    <div className="space-y-3">
      <p className="text-xs text-[var(--color-muted)]">
        Account saved. The dashboard stores credentials encrypted for its own
        reads — no extra setup needed for local dashboard use.
      </p>
      <details className="rounded-lg border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)]">
        <summary className="cursor-pointer px-3 py-2 text-xs font-semibold text-[var(--color-muted)] hover:text-[var(--color-text)]">
          Show env-var snippet for cloud routines
          <span className="ml-1 text-[10px] font-normal text-[var(--color-muted)]">
            (skip if you only use the dashboard)
          </span>
        </summary>
        <div className="space-y-3 px-3 pb-3 pt-1">
          <p className="text-[11px] text-[var(--color-muted)]">
            To let cloud routines (and the bash wrappers) reach this account,
            export these env vars in your Claude Code routine config:
          </p>
          <pre className="text-[11px] font-mono bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] rounded-lg p-3 whitespace-pre-wrap break-all leading-relaxed">
            {lines}
          </pre>
          <div className="text-[10px] text-[var(--color-muted)]">
            The dashboard derives the namespace by uppercasing the account id
            and replacing hyphens with underscores. Bash wrapper looks them up
            via <code className="mx-1">--account-id={"<slug>"}</code>. Local
            execution falls back to the legacy <code>ALPACA_*</code> /{" "}
            <code>ALPACA_PAPER_*</code> in <code>.env</code> when these
            aren&apos;t set.
          </div>
          <div className="flex justify-end pt-1">
            <button
              type="button"
              onClick={copy}
              className="glass rounded-full px-3 py-1.5 text-xs font-semibold"
            >
              {copied ? "✓ Copied" : "Copy snippet"}
            </button>
          </div>
        </div>
      </details>
      <div className="flex items-center justify-end pt-1">
        <button
          type="button"
          onClick={onDone}
          className="glass glass-tint-up rounded-full px-3 py-1.5 text-xs font-semibold"
        >
          Done
        </button>
      </div>
    </div>
  );
}

// ─── New bot modal ───────────────────────────────────────────────────

function BotForm({
  accounts,
  existingBots,
  onClose,
}: {
  accounts: RedactedAccount[];
  existingBots: Bot[];
  onClose: () => void;
}) {
  const [id, setId] = useState("");
  const [name, setName] = useState("");
  const [accountId, setAccountId] = useState(accounts[0]?.id ?? "");
  const [useFullAccount, setUseFullAccount] = useState(true);
  const [allocation, setAllocation] = useState("");
  const [strategySlug, setStrategySlug] = useState("default");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const account = accounts.find((a) => a.id === accountId);
  const otherAllocations = existingBots
    .filter((b) => b.accountId === accountId)
    .reduce((sum, b) => sum + (b.allocation ?? 0), 0);
  const remainingCapital =
    account?.totalCapital != null ? account.totalCapital - otherAllocations : null;

  const draftAmount = useFullAccount ? null : Number(allocation);
  const allocationSlices = buildAllocationSlices({
    accountBots: existingBots.filter((b) => b.accountId === accountId),
    draft: {
      id: "__new__",
      label: name.trim() || "(this new bot)",
      amount: !useFullAccount && Number.isFinite(draftAmount) ? draftAmount : null,
      hasAllocation: !useFullAccount,
    },
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(BOTS_URL, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id,
          name,
          accountId,
          allocation: useFullAccount ? null : Number(allocation),
          strategySlug,
          enabled: true,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      mutate(BOTS_URL);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} title="New bot">
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Bot id (slug)" hint="Used in memory paths and client_order_id prefix.">
          <input
            required
            value={id}
            onChange={(e) => setId(e.target.value)}
            placeholder="momentum-10k"
            className={inputClass}
          />
        </Field>
        <Field label="Display name">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Momentum 10k"
            className={inputClass}
          />
        </Field>
        <Field label="Account">
          <select
            required
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className={inputClass}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label} ({a.mode})
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Capital"
          hint={
            useFullAccount
              ? "Bot uses the entire account's equity for sizing math."
              : remainingCapital != null
              ? `Remaining: ${remainingCapital.toLocaleString("en-US", { style: "currency", currency: "USD" })}`
              : "Account has no totalCapital set; allocation is informational only."
          }
        >
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={useFullAccount}
                onChange={(e) => setUseFullAccount(e.target.checked)}
              />
              Use entire account
            </label>
            {!useFullAccount && (
              <input
                required
                value={allocation}
                onChange={(e) => setAllocation(e.target.value)}
                type="number"
                min="0"
                step="any"
                placeholder="10000"
                className={inputClass}
              />
            )}
          </div>
        </Field>
        <AllocationBar
          totalCapital={account?.totalCapital ?? null}
          slices={allocationSlices}
        />
        <Field label="Strategy slug" hint="Memory dir: memory/<bot>/<strategy>/">
          <input
            value={strategySlug}
            onChange={(e) => setStrategySlug(e.target.value)}
            placeholder="default"
            className={inputClass}
          />
        </Field>

        {error && <div className="text-xs text-[var(--color-down)]">{error}</div>}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="glass rounded-full px-3 py-1.5 text-xs"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="glass glass-tint-up rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            {busy ? "Saving…" : "Create bot"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Allocation slice builder (shared by Create + Edit forms) ────────

function buildAllocationSlices({
  accountBots,
  draft,
  excludeBotId,
}: {
  accountBots: Bot[];
  draft: { id: string; label: string; amount: number | null; hasAllocation: boolean };
  /** When editing an existing bot, don't double-count its previous slice
   *  alongside its draft slice. */
  excludeBotId?: string;
}): AllocationSlice[] {
  const slices: AllocationSlice[] = [];
  for (const b of accountBots) {
    if (excludeBotId && b.id === excludeBotId) continue;
    if (b.allocation == null) {
      slices.push({ id: b.id, label: b.name, amount: null, variant: "existing" });
    } else {
      slices.push({
        id: b.id,
        label: b.name,
        amount: b.allocation,
        variant: "existing",
      });
    }
  }
  if (draft.hasAllocation) {
    slices.push({
      id: draft.id,
      label: draft.label,
      amount: draft.amount,
      variant: "draft",
    });
  } else {
    slices.push({ id: draft.id, label: draft.label, amount: null, variant: "draft" });
  }
  return slices;
}

// ─── Edit existing bot modal ─────────────────────────────────────────

function EditBotForm({
  bot,
  accounts,
  existingBots,
  onClose,
}: {
  bot: Bot;
  accounts: RedactedAccount[];
  existingBots: Bot[];
  onClose: () => void;
}) {
  const [name, setName] = useState(bot.name);
  const [accountId, setAccountId] = useState(bot.accountId);
  const [useFullAccount, setUseFullAccount] = useState(bot.allocation == null);
  const [allocation, setAllocation] = useState(
    bot.allocation == null ? "" : String(bot.allocation)
  );
  const [strategySlug, setStrategySlug] = useState(bot.strategySlug);
  const [discordWebhookUrl, setDiscordWebhookUrl] = useState(
    bot.discordWebhookUrl ?? ""
  );
  const [sentinelEnabled, setSentinelEnabled] = useState(
    bot.sentinel?.enabled ?? false
  );
  const [sentinelCap, setSentinelCap] = useState(
    String(bot.sentinel?.consecutiveLossesCap ?? 3)
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const account = accounts.find((a) => a.id === accountId);
  const otherAllocations = existingBots
    .filter((b) => b.accountId === accountId && b.id !== bot.id)
    .reduce((sum, b) => sum + (b.allocation ?? 0), 0);
  const remainingCapital =
    account?.totalCapital != null ? account.totalCapital - otherAllocations : null;

  const draftAmount = useFullAccount ? null : Number(allocation);
  const allocationSlices = buildAllocationSlices({
    accountBots: existingBots.filter((b) => b.accountId === accountId),
    excludeBotId: bot.id,
    draft: {
      id: bot.id,
      label: name.trim() || bot.name,
      amount: !useFullAccount && Number.isFinite(draftAmount) ? draftAmount : null,
      hasAllocation: !useFullAccount,
    },
  });

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const sentinel = sentinelEnabled
        ? {
            enabled: true,
            consecutiveLossesCap: Math.max(
              2,
              Math.min(20, Number(sentinelCap) || 3)
            ),
          }
        : null;
      const res = await fetch(`${BOTS_URL}/${encodeURIComponent(bot.id)}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name,
          accountId,
          allocation: useFullAccount ? null : Number(allocation),
          strategySlug,
          discordWebhookUrl: discordWebhookUrl.trim() || "",
          sentinel,
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      mutate(BOTS_URL);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal onClose={onClose} title={`Edit bot — ${bot.id}`}>
      <form onSubmit={onSubmit} className="space-y-3">
        <Field
          label="Bot id"
          hint="Slug is immutable — drives memory paths and client_order_id prefix."
        >
          <input
            disabled
            value={bot.id}
            className={`${inputClass} opacity-60 cursor-not-allowed`}
          />
        </Field>
        <Field label="Display name">
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="Account">
          <select
            required
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className={inputClass}
          >
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.label} ({a.mode})
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Capital"
          hint={
            useFullAccount
              ? "Bot uses the entire account's equity for sizing math."
              : remainingCapital != null
              ? `Remaining (excl. this bot): ${remainingCapital.toLocaleString("en-US", { style: "currency", currency: "USD" })}`
              : "Account has no totalCapital set; allocation is informational only."
          }
        >
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={useFullAccount}
                onChange={(e) => setUseFullAccount(e.target.checked)}
              />
              Use entire account
            </label>
            {!useFullAccount && (
              <input
                required
                value={allocation}
                onChange={(e) => setAllocation(e.target.value)}
                type="number"
                min="0"
                step="any"
                placeholder="10000"
                className={inputClass}
              />
            )}
          </div>
        </Field>
        <AllocationBar
          totalCapital={account?.totalCapital ?? null}
          slices={allocationSlices}
        />
        <Field label="Strategy slug" hint="Memory dir: memory/<bot>/<strategy>/">
          <input
            value={strategySlug}
            onChange={(e) => setStrategySlug(e.target.value)}
            placeholder="default"
            className={inputClass}
          />
        </Field>

        <Field
          label="Discord webhook (override)"
          hint="Optional — when set, this bot's dashboard sends post here instead of the global webhook. Leave blank to inherit."
        >
          <input
            type="url"
            value={discordWebhookUrl}
            onChange={(e) => setDiscordWebhookUrl(e.target.value)}
            placeholder="https://discord.com/api/webhooks/…"
            className={inputClass}
          />
        </Field>

        <Field
          label="Sandbox sentinel"
          hint="Auto-disable this bot after N consecutive losing trades."
        >
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={sentinelEnabled}
                onChange={(e) => setSentinelEnabled(e.target.checked)}
              />
              Auto-disable on losing streak
            </label>
            {sentinelEnabled && (
              <div className="flex items-center gap-2 text-xs">
                <span className="text-[var(--color-muted)]">Trip after</span>
                <input
                  type="number"
                  min={2}
                  max={20}
                  value={sentinelCap}
                  onChange={(e) => setSentinelCap(e.target.value)}
                  className={`${inputClass} w-20`}
                />
                <span className="text-[var(--color-muted)]">consecutive losses</span>
              </div>
            )}
          </div>
        </Field>

        {error && <div className="text-xs text-[var(--color-down)]">{error}</div>}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="glass rounded-full px-3 py-1.5 text-xs"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={busy}
            className="glass glass-tint-up rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50"
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
        </div>
      </form>
    </Modal>
  );
}

// ─── Generic modal + form primitives ──────────────────────────────────

const inputClass =
  "w-full rounded-lg bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)] px-3 py-1.5 text-sm focus:outline-none focus:border-[var(--color-accent)]";

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block text-xs">
      <div className="font-semibold mb-1">{label}</div>
      {children}
      {hint && (
        <div className="text-[10px] text-[var(--color-muted)] mt-1">{hint}</div>
      )}
    </label>
  );
}

/** Audit U9 — replaces native browser `confirm()` for destructive actions
 *  with the same Modal primitive used by the form dialogs. Async-confirm
 *  aware: surfaces `busy` and `error` so the caller doesn't have to render
 *  its own status while the request is in flight. */
function ConfirmDialog({
  title,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  destructive = false,
  busy = false,
  error,
  onConfirm,
  onCancel,
}: {
  title: string;
  children: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  busy?: boolean;
  error?: string | null;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}) {
  return (
    <Modal title={title} onClose={onCancel}>
      <div className="space-y-3 text-xs leading-relaxed text-[var(--color-text)]">
        <div>{children}</div>
        {error && (
          <div className="text-[var(--color-down)] break-all">{error}</div>
        )}
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="glass rounded-full px-3 py-1.5 text-xs disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className={`glass rounded-full px-3 py-1.5 text-xs font-semibold disabled:opacity-50 ${
              destructive ? "glass-tint-down" : "glass-tint-accent"
            }`}
          >
            {busy ? "Working…" : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Modal({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 backdrop-blur-sm p-4 overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="frost rounded-2xl p-5 w-full max-w-md mt-12"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-[var(--color-muted)] hover:text-[var(--color-text)] text-lg leading-none"
          >
            ×
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
