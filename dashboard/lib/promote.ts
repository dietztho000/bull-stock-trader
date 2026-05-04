import "server-only";
import fs from "node:fs/promises";
import path from "node:path";
import { resolveMemoryFile } from "./memoryPath";
import { listBots } from "./settings";
import { todayInCT, fmtDateTimeCT } from "./time";
import { diffLines, summarizeDiff, type DiffLine } from "./diff";

export type { DiffLine } from "./diff";

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
 *  file but doesn't double-write the TRADE-LOG section. */
export async function applyPromotion(
  ctx: PromoteContext,
  diff: PromoteDiff
): Promise<{ wroteStrategy: boolean; wroteAnchor: boolean }> {
  if (diff.identical) {
    return { wroteStrategy: false, wroteAnchor: false };
  }
  const sourceContent = await safeRead(ctx.sourcePath);
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
  return { wroteStrategy: true, wroteAnchor };
}
