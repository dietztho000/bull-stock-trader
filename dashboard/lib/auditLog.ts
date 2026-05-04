import "server-only";
import path from "node:path";
import fs from "node:fs/promises";
import { resolveMemoryFile } from "./memoryPath";

const AUDIT_FILE = resolveMemoryFile("DASHBOARD-AUDIT.jsonl");

export type AuditEvent = {
  ts: string;
  action: string;
  mode: "live" | "paper";
  /** New: account + bot context. Optional for back-compat with pre-migration
   *  entries; new write paths always populate them. */
  accountId?: string;
  botId?: string;
  symbol?: string;
  detail?: Record<string, unknown>;
  ok: boolean;
  error?: string;
};

/** Append-only JSONL audit log of write actions issued from the dashboard.
 *  This is the dashboard's authoritative trail — Alpaca's own activities feed
 *  is source-of-truth for fills, but doesn't capture intent (e.g. who hit
 *  "Force exit" vs the bot's market-open routine). */
export async function appendAudit(event: Omit<AuditEvent, "ts">): Promise<void> {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...event }) + "\n";
  try {
    await fs.mkdir(path.dirname(AUDIT_FILE), { recursive: true });
    await fs.appendFile(AUDIT_FILE, line, "utf8");
  } catch (err) {
    // Audit failures must never block trading; surface them to stderr so
    // they can be investigated, but always succeed silently.
    console.error("[audit] failed to append", err);
  }
}

// ─── Rate limiter ───────────────────────────────────────────────────────────

type Bucket = { tokens: number; lastRefill: number };
const BUCKETS = new Map<string, Bucket>();

const RATE_PER_MIN = 30;
const BURST = 10;
const REFILL_INTERVAL_MS = 60_000 / RATE_PER_MIN;

/** Simple in-memory token bucket per (mode, route) tuple. Returns
 *  `{ ok: false, retryAfterMs }` when the caller exceeded the budget. */
export function checkRateLimit(key: string): { ok: true } | { ok: false; retryAfterMs: number } {
  const now = Date.now();
  const bucket = BUCKETS.get(key) ?? { tokens: BURST, lastRefill: now };
  // Refill: 1 token per REFILL_INTERVAL_MS, capped at BURST.
  const elapsed = now - bucket.lastRefill;
  const refill = Math.floor(elapsed / REFILL_INTERVAL_MS);
  if (refill > 0) {
    bucket.tokens = Math.min(BURST, bucket.tokens + refill);
    bucket.lastRefill += refill * REFILL_INTERVAL_MS;
  }
  if (bucket.tokens <= 0) {
    BUCKETS.set(key, bucket);
    const retryAfterMs = REFILL_INTERVAL_MS - (now - bucket.lastRefill);
    return { ok: false, retryAfterMs: Math.max(0, retryAfterMs) };
  }
  bucket.tokens -= 1;
  BUCKETS.set(key, bucket);
  return { ok: true };
}
