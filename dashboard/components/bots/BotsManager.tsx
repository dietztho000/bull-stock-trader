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
import { HealthDot } from "./HealthDot";
import { DiscordTestButton } from "./DiscordTestButton";
import { RotateAccountCredsModal } from "./RotateAccountCredsModal";
import {
  AccountForm,
  BotForm,
  EditBotForm,
  ConfirmDialog,
} from "./BotsManagerForms";

const fetcher = (url: string) => fetch(url).then((r) => r.json());

const ACCOUNTS_URL = "/api/accounts";
// includeDisabled=true so the admin page can still see disabled bots and
// re-enable them. The unscoped /api/bots default filters to enabled-only.
const BOTS_URL = "/api/bots?includeDisabled=true";

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
            <a
              href="/strategies"
              title="Manage strategies"
              className="hover:opacity-80"
            >
              <Badge tone="neutral">{bot.strategySlug}</Badge>
            </a>
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

