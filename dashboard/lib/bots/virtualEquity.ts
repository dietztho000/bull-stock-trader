import "server-only";
import { runAlpaca } from "@/lib/alpaca";
import { listBots } from "@/lib/settings";
import {
  getAccountPositions,
  getBotPositions,
  type BotPosition,
} from "./perBotPositions";
import type { AlpacaAccount } from "@/lib/types/alpaca";

export type BotEquity = {
  botId: string;
  accountId: string;
  /** When `null`, this bot is the sole occupant of its account and reports
   *  raw Alpaca equity. When a number, the bot has a soft allocation and
   *  we synthesize equity from `allocation +/- attributed P&L`. */
  allocation: number | null;
  equity: number;
  cash: number;
  deployed: number;
  unrealizedPl: number;
  positions: BotPosition[];
  /** True when the math came from the registry slice; false when the bot
   *  had no allocation and we passed through the raw Alpaca account. */
  isVirtual: boolean;
};

export async function botEquity(botId: string): Promise<BotEquity> {
  const bots = await listBots();
  const bot = bots.find((b) => b.id === botId);
  if (!bot) throw new Error(`Bot "${botId}" not found`);

  // Sole-occupant bots: no allocation math, just mirror Alpaca. Also pull
  // the raw positions list so the /bots/compare view can surface holdings
  // uniformly regardless of soft-allocation status. Positions go through
  // the per-account cache so a leaderboard fan-out doesn't N×-spam Alpaca.
  if (bot.allocation == null) {
    const [account, livePositions] = await Promise.all([
      runAlpaca("account", [], { accountId: bot.accountId }) as Promise<AlpacaAccount>,
      getAccountPositions(bot.accountId),
    ]);
    const equity = Number(account.equity);
    const cash = Number(account.cash);
    const positions: BotPosition[] = (Array.isArray(livePositions) ? livePositions : []).map(
      (p) => {
        const qty = Number(p.qty);
        const avgEntryPrice = Number(p.avg_entry_price);
        const currentPrice = Number(p.current_price);
        const marketValue = Number(p.market_value);
        const costBasis = qty * avgEntryPrice;
        const unrealizedPl = Number(p.unrealized_pl);
        const unrealizedPlpc = Number(p.unrealized_plpc);
        return {
          symbol: p.symbol,
          qty,
          avgEntryPrice,
          currentPrice,
          marketValue,
          costBasis,
          unrealizedPl,
          unrealizedPlpc,
        };
      }
    );
    return {
      botId,
      accountId: bot.accountId,
      allocation: null,
      equity,
      cash,
      deployed: equity - cash,
      unrealizedPl: positions.reduce((sum, p) => sum + p.unrealizedPl, 0),
      positions,
      isVirtual: false,
    };
  }

  // Allocated bot: compute virtual equity from tagged fills.
  const positions = await getBotPositions(botId);
  const deployed = positions.reduce((sum, p) => sum + p.marketValue, 0);
  const unrealizedPl = positions.reduce((sum, p) => sum + p.unrealizedPl, 0);
  const costBasis = positions.reduce((sum, p) => sum + p.costBasis, 0);
  const cash = bot.allocation - costBasis;
  const equity = bot.allocation + unrealizedPl;

  return {
    botId,
    accountId: bot.accountId,
    allocation: bot.allocation,
    equity,
    cash,
    deployed,
    unrealizedPl,
    positions,
    isVirtual: true,
  };
}
