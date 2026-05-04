import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { resolveMemoryFile, BOT_ROOT } from "./memoryPath";
import { listBots } from "./settings";
import { todayInCT, fmtDateTimeCT } from "./time";
import { diffLines, summarizeDiff, type DiffLine } from "./diff";

export type { DiffLine } from "./diff";

/** memory/shared/PROMOTION-LOG.jsonl — append-only audit + rollback source.
 *  Each line is one promote or rollback event. The rollback flow reads the
 *  most recent `promote` entry for the given target and replays its
 *  `priorTargetContent` back into the target's TRADING-STRATEGY.md. */
const PROMOTION_LOG_PATH = path.join(
  BOT_ROOT,
  "memory",
  "shared",
  "PROMOTION-LOG.jsonl"
);

export type PromotionLogEntry =
  | {
      kind: "promote";
      ts: string;
      sourceBotId: string;
      targetBotId: string;
      added: number;
      removed: number;
      /** Target's TRADING-STRATEGY.md content BEFORE the overwrite — the
       *  rollback button replays this back into the target. Empty string
       *  when the target had no prior strategy file. */
      priorTargetContent: string;
    }
  | {
      kind: "rollback";
      ts: string;
      targetBotId: string;
      /** ISO ts of the promote entry this rolled back. */
      revertedPromoteTs: string;
    };

export type PromoteDiff = {
  added: number;
  removed: number;
  identical: boolean;
  /** Compact unified-style diff lines (full file, no context window). */
  lines: DiffLine[];
};

export type PromoteContext = {
  source: { id: string; strategy: string; mode: "live" | "paper" };
  target: { id: string; strategy: string; mode: "live" | "paper" };
  sourcePath: string;
  targetPath: string;
};

export async function resolvePromoteCtx(
  sourceBotId: string,
  targetBotId: string
): Promise<PromoteContext | { error: string; status: number }> {
  const bots = await listBots();
  const source = bots.find((b) => b.id === sourceBotId);
  if (!source) return { error: `source bot "${sourceBotId}" not found`, status: 404 };
  const target = bots.find((b) => b.id === targetBotId);
  if (!target) return { error: `target bot "${targetBotId}" not found`, status: 404 };
  if (source.id === target.id) {
    return { error: "source and target must differ", status: 400 };
  }
  return {
    source: { id: source.id, strategy: source.strategySlug, mode: "paper" },
    target: { id: target.id, strategy: target.strategySlug, mode: "live" },
    sourcePath: resolveMemoryFile("TRADING-STRATEGY.md", {
      bot: source.id,
      strategy: source.strategySlug,
    }),
    targetPath: resolveMemoryFile("TRADING-STRATEGY.md", {
      bot: target.id,
      strategy: target.strategySlug,
    }),
  };
}

async function safeRead(filePath: string): Promise<string> {
  try {
    return await fs.readFile(filePath, "utf8");
  } catch {
    return "";
  }
}

export async function diffStrategy(ctx: PromoteContext): Promise<PromoteDiff> {
  const [sourceContent, targetContent] = await Promise.all([
    safeRead(ctx.sourcePath),
    safeRead(ctx.targetPath),
  ]);
  const lines = diffLines(targetContent, sourceContent);
  return { ...summarizeDiff(lines), lines };
}

/** Replaces the target's TRADING-STRATEGY.md with the source's content and
 *  appends a dated anchor to the target's TRADE-LOG.md so the promotion
 *  shows up in the audit trail. Idempotent on the same calendar day:
 *  re-promoting the same source under the same anchor swaps the strategy
 *  file but doesn't double-write the TRADE-LOG section.
 *
 *  Audit F9: also appends a `promote` entry to PROMOTION-LOG.jsonl
 *  capturing the target's PRIOR content so the rollback button can
 *  replay it. */
export async function applyPromotion(
  ctx: PromoteContext,
  diff: PromoteDiff
): Promise<{ wroteStrategy: boolean; wroteAnchor: boolean }> {
  if (diff.identical) {
    return { wroteStrategy: false, wroteAnchor: false };
  }
  const [sourceContent, priorTargetContent] = await Promise.all([
    safeRead(ctx.sourcePath),
    safeRead(ctx.targetPath),
  ]);
  await fs.mkdir(path.dirname(ctx.targetPath), { recursive: true });
  await fs.writeFile(ctx.targetPath, sourceContent, "utf8");

  const tradeLogPath = resolveMemoryFile("TRADE-LOG.md", {
    bot: ctx.target.id,
    strategy: ctx.target.strategy,
  });
  const today = todayInCT();
  const anchor = `## Strategy update — promoted from ${ctx.source.id} (${today})`;
  const existing = await safeRead(tradeLogPath);
  const wroteAnchor = !existing.includes(anchor);
  if (wroteAnchor) {
    const generatedAt = fmtDateTimeCT(new Date());
    const body = `\n${anchor}\n\nApplied at ${generatedAt} CT via dashboard promote.\n+${diff.added} / -${diff.removed} lines vs prior strategy.\n`;
    await fs.mkdir(path.dirname(tradeLogPath), { recursive: true });
    await fs.appendFile(tradeLogPath, body, "utf8");
  }

  await appendPromotionLog({
    kind: "promote",
    ts: new Date().toISOString(),
    sourceBotId: ctx.source.id,
    targetBotId: ctx.target.id,
    added: diff.added,
    removed: diff.removed,
    priorTargetContent,
  });

  return { wroteStrategy: true, wroteAnchor };
}

async function appendPromotionLog(entry: PromotionLogEntry): Promise<void> {
  await fs.mkdir(path.dirname(PROMOTION_LOG_PATH), { recursive: true });
  await fs.appendFile(PROMOTION_LOG_PATH, JSON.stringify(entry) + "\n", "utf8");
}

/** Reads the most recent `promote` entry for the given target that has not
 *  already been rolled back. Returns null when no rollback target exists. */
export async function getRollbackCandidate(
  targetBotId: string
): Promise<Extract<PromotionLogEntry, { kind: "promote" }> | null> {
  const raw = await safeRead(PROMOTION_LOG_PATH);
  if (!raw) return null;
  const entries: PromotionLogEntry[] = [];
  for (const line of raw.split("\n")) {
    if (!line.trim()) continue;
    try {
      entries.push(JSON.parse(line) as PromotionLogEntry);
    } catch {
      // Skip malformed lines — log file might have been hand-edited.
    }
  }
  // Walk newest-first. If we hit a rollback for this target before its
  // matching promote, the prior promote was already reverted — keep
  // walking past both to find an earlier candidate.
  const consumedTimestamps = new Set<string>();
  for (let i = entries.length - 1; i >= 0; i--) {
    const e = entries[i];
    if (e.kind === "rollback" && e.targetBotId === targetBotId) {
      consumedTimestamps.add(e.revertedPromoteTs);
      continue;
    }
    if (
      e.kind === "promote" &&
      e.targetBotId === targetBotId &&
      !consumedTimestamps.has(e.ts)
    ) {
      return e;
    }
  }
  return null;
}

/** Restore the target's TRADING-STRATEGY.md to the content captured in the
 *  most recent un-rolled-back promote entry. Appends a TRADE-LOG anchor +
 *  a PROMOTION-LOG `rollback` entry for traceability. */
export async function rollbackLastPromotion(
  targetBotId: string
): Promise<
  | { ok: true; revertedFrom: string; revertedPromoteTs: string }
  | { ok: false; error: string; status: number }
> {
  const candidate = await getRollbackCandidate(targetBotId);
  if (!candidate) {
    return { ok: false, error: "no rollback candidate found for this bot", status: 404 };
  }
  const bots = await listBots();
  const target = bots.find((b) => b.id === targetBotId);
  if (!target) {
    return { ok: false, error: `bot "${targetBotId}" not found`, status: 404 };
  }
  const targetPath = resolveMemoryFile("TRADING-STRATEGY.md", {
    bot: target.id,
    strategy: target.strategySlug,
  });
  await fs.mkdir(path.dirname(targetPath), { recursive: true });
  await fs.writeFile(targetPath, candidate.priorTargetContent, "utf8");

  const tradeLogPath = resolveMemoryFile("TRADE-LOG.md", {
    bot: target.id,
    strategy: target.strategySlug,
  });
  const today = todayInCT();
  const anchor = `## Strategy rollback — restored prior to ${candidate.sourceBotId} promotion (${today})`;
  const existing = await safeRead(tradeLogPath);
  if (!existing.includes(anchor)) {
    const generatedAt = fmtDateTimeCT(new Date());
    const body = `\n${anchor}\n\nApplied at ${generatedAt} CT via dashboard rollback.\nReverted promote from ${candidate.sourceBotId} (originally applied ${fmtDateTimeCT(candidate.ts)} CT).\n`;
    await fs.mkdir(path.dirname(tradeLogPath), { recursive: true });
    await fs.appendFile(tradeLogPath, body, "utf8");
  }

  await appendPromotionLog({
    kind: "rollback",
    ts: new Date().toISOString(),
    targetBotId: target.id,
    revertedPromoteTs: candidate.ts,
  });

  return {
    ok: true,
    revertedFrom: candidate.sourceBotId,
    revertedPromoteTs: candidate.ts,
  };
}
