"use client";

import { useState } from "react";
import clsx from "clsx";
import { Card, Badge } from "@/components/ui/Card";

type FieldKey = "webhookUrl" | "webhookUrlResearch" | "ntfyTopic";

type RedactedField = {
  isSet: boolean;
  source: "settings" | "env" | "none";
  hint: string | null;
};

type Redacted = {
  discord: Record<FieldKey, RedactedField>;
};

type RowMeta = {
  key: FieldKey;
  label: string;
  description: string;
  placeholder: string;
  envName: string;
  validate: (v: string) => string | null;
  kind: "webhook" | "topic";
};

const ROWS: RowMeta[] = [
  {
    key: "webhookUrl",
    label: "Default Discord webhook",
    description:
      "Used as the fallback for every category. Categories without a more specific override (below) post here.",
    placeholder: "https://discord.com/api/webhooks/…",
    envName: "DISCORD_WEBHOOK_URL",
    kind: "webhook",
    validate: (v) => {
      if (!v) return null;
      if (
        !v.startsWith("https://discord.com/api/webhooks/") &&
        !v.startsWith("https://discordapp.com/api/webhooks/")
      ) {
        return "Must start with https://discord.com/api/webhooks/";
      }
      return null;
    },
  },
  {
    key: "webhookUrlResearch",
    label: "Research webhook (pre-market briefs)",
    description:
      "Pre-Market Discord Briefs go here. Falls back to the default webhook if unset.",
    placeholder: "https://discord.com/api/webhooks/…",
    envName: "DISCORD_WEBHOOK_URL_RESEARCH",
    kind: "webhook",
    validate: (v) => {
      if (!v) return null;
      if (
        !v.startsWith("https://discord.com/api/webhooks/") &&
        !v.startsWith("https://discordapp.com/api/webhooks/")
      ) {
        return "Must start with https://discord.com/api/webhooks/";
      }
      return null;
    },
  },
  {
    key: "ntfyTopic",
    label: "ntfy.sh topic (optional mirror)",
    description:
      "Free push notification mirror — every Discord message is also POSTed to https://ntfy.sh/<topic>. Pick a long, hard-to-guess name.",
    placeholder: "long-random-string",
    envName: "NTFY_TOPIC",
    kind: "topic",
    validate: (v) => {
      if (!v) return null;
      if (v.length < 6) return "Pick at least 6 characters";
      if (v.length > 80) return "Max 80 characters";
      return null;
    },
  },
];

export function SettingsForm({ initial }: { initial: Redacted }) {
  const [redacted, setRedacted] = useState<Redacted>(initial);
  const [drafts, setDrafts] = useState<Record<FieldKey, string>>({
    webhookUrl: "",
    webhookUrlResearch: "",
    ntfyTopic: "",
  });
  const [editing, setEditing] = useState<Record<FieldKey, boolean>>({
    webhookUrl: false,
    webhookUrlResearch: false,
    ntfyTopic: false,
  });
  const [errors, setErrors] = useState<Record<FieldKey, string | null>>({
    webhookUrl: null,
    webhookUrlResearch: null,
    ntfyTopic: null,
  });
  const [pending, setPending] = useState<FieldKey | null>(null);
  const [testStatus, setTestStatus] = useState<
    | { kind: "idle" }
    | { kind: "sending" }
    | { kind: "ok"; delivery: string }
    | { kind: "error"; message: string }
  >({ kind: "idle" });

  async function save(key: FieldKey) {
    const meta = ROWS.find((r) => r.key === key)!;
    const value = drafts[key].trim();
    const err = meta.validate(value);
    setErrors((prev) => ({ ...prev, [key]: err }));
    if (err) return;
    setPending(key);
    try {
      const resp = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discord: { [key]: value === "" ? null : value } }),
      });
      const data = await resp.json();
      if (!resp.ok) {
        setErrors((prev) => ({ ...prev, [key]: data?.error ?? `HTTP ${resp.status}` }));
        return;
      }
      setRedacted(data);
      setDrafts((prev) => ({ ...prev, [key]: "" }));
      setEditing((prev) => ({ ...prev, [key]: false }));
    } finally {
      setPending(null);
    }
  }

  async function clearField(key: FieldKey) {
    setPending(key);
    try {
      const resp = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discord: { [key]: null } }),
      });
      if (resp.ok) setRedacted(await resp.json());
    } finally {
      setPending(null);
    }
  }

  async function sendTest() {
    setTestStatus({ kind: "sending" });
    try {
      const resp = await fetch("/api/discord/brief?test=true", { method: "POST" });
      const data = await resp.json();
      if (!resp.ok) {
        setTestStatus({ kind: "error", message: data?.error ?? `HTTP ${resp.status}` });
        return;
      }
      setTestStatus({ kind: "ok", delivery: data.delivery });
    } catch (err) {
      setTestStatus({
        kind: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return (
    <div className="space-y-5">
      <Card title="Discord webhooks" subtitle="Override .env values without restarting the dev server.">
        <div className="space-y-5">
          {ROWS.map((row) => {
            const field = redacted.discord[row.key];
            const editingThis = editing[row.key];
            const error = errors[row.key];
            const isPending = pending === row.key;
            return (
              <div key={row.key} className="border-b border-[rgba(255,255,255,0.06)] last:border-b-0 pb-5 last:pb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
                  <label className="text-sm font-medium text-[var(--color-text)]">
                    {row.label}
                  </label>
                  <SourceBadge field={field} />
                </div>
                <p className="text-xs text-[var(--color-muted)] mb-2 leading-relaxed">
                  {row.description} · env var:{" "}
                  <code className="font-mono text-[var(--color-text)]">{row.envName}</code>
                </p>

                {!editingThis && (
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="font-mono text-xs text-[var(--color-muted)] glass rounded-lg px-3 py-1.5 flex-1 min-w-[180px]">
                      {field.isSet ? `••••${field.hint ?? ""}` : "(not set)"}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setEditing((prev) => ({ ...prev, [row.key]: true }));
                        setDrafts((prev) => ({ ...prev, [row.key]: "" }));
                        setErrors((prev) => ({ ...prev, [row.key]: null }));
                      }}
                      className="glass glass-interactive rounded-full px-3 py-1.5 text-xs font-medium"
                    >
                      {field.source === "settings" ? "Replace" : "Set override"}
                    </button>
                    {field.source === "settings" && (
                      <button
                        type="button"
                        onClick={() => clearField(row.key)}
                        disabled={isPending}
                        className="glass glass-interactive glass-tint-down rounded-full px-3 py-1.5 text-xs font-medium text-[var(--color-down)] disabled:opacity-50"
                      >
                        {isPending ? "…" : "Clear"}
                      </button>
                    )}
                  </div>
                )}

                {editingThis && (
                  <div className="space-y-2">
                    <input
                      type="text"
                      autoFocus
                      placeholder={row.placeholder}
                      value={drafts[row.key]}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [row.key]: e.target.value }))
                      }
                      className="w-full font-mono text-xs px-3 py-2 rounded-lg glass text-[var(--color-text)] focus:outline-none focus:border-[var(--color-accent)] placeholder:text-[var(--color-muted)]"
                    />
                    {error && (
                      <div className="text-[11px] text-[var(--color-down)]">{error}</div>
                    )}
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => save(row.key)}
                        disabled={isPending}
                        className="glass glass-interactive glass-tint-accent rounded-full px-4 py-1.5 text-xs font-semibold disabled:opacity-50"
                      >
                        {isPending ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing((prev) => ({ ...prev, [row.key]: false }));
                          setDrafts((prev) => ({ ...prev, [row.key]: "" }));
                          setErrors((prev) => ({ ...prev, [row.key]: null }));
                        }}
                        className="glass glass-interactive rounded-full px-3 py-1.5 text-xs font-medium"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </Card>

      <Card
        title="Test webhook"
        subtitle="Send a tiny test message via the same path as the Pre-Market Brief."
      >
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={sendTest}
            disabled={testStatus.kind === "sending"}
            className={clsx(
              "glass glass-interactive rounded-full px-4 py-1.5 text-xs font-medium",
              testStatus.kind === "sending" && "opacity-50 cursor-not-allowed"
            )}
          >
            {testStatus.kind === "sending" ? "Sending…" : "Send test message"}
          </button>
          <div className="text-xs">
            {testStatus.kind === "ok" && testStatus.delivery === "webhook" && (
              <span className="text-[var(--color-up)]">✓ Delivered to Discord</span>
            )}
            {testStatus.kind === "ok" && testStatus.delivery === "fallback-file" && (
              <span className="text-[var(--color-warn)]">
                Webhook not set — wrote to DAILY-SUMMARY.md
              </span>
            )}
            {testStatus.kind === "ok" && testStatus.delivery === "ntfy-only" && (
              <span className="text-[var(--color-muted)]">Sent via ntfy.sh only</span>
            )}
            {testStatus.kind === "error" && (
              <span className="text-[var(--color-down)] break-all">
                Failed: {testStatus.message}
              </span>
            )}
          </div>
        </div>
      </Card>

      <Card title="What this overrides">
        <div className="text-xs text-[var(--color-muted)] leading-relaxed space-y-2">
          <p>
            Settings are stored in{" "}
            <code className="font-mono text-[var(--color-text)]">memory/dashboard-settings.json</code>{" "}
            (gitignored). On each Discord send, the dashboard merges these values into the child
            process env so{" "}
            <code className="font-mono text-[var(--color-text)]">scripts/discord.sh</code> uses them
            in place of any value in <code className="font-mono text-[var(--color-text)]">.env</code>.
          </p>
          <p>
            <strong>The bot's CLI routines do NOT see these overrides.</strong> They read from{" "}
            <code className="font-mono text-[var(--color-text)]">.env</code> directly. To change the
            bot's webhook, edit <code className="font-mono text-[var(--color-text)]">.env</code>.
          </p>
          <p>Press <strong>Clear</strong> to remove a dashboard override and fall back to env.</p>
        </div>
      </Card>
    </div>
  );
}

function SourceBadge({ field }: { field: RedactedField }) {
  if (field.source === "settings") return <Badge tone="up">overridden in settings</Badge>;
  if (field.source === "env") return <Badge tone="neutral">from .env</Badge>;
  return <Badge tone="warn">not set</Badge>;
}

