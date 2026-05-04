import "server-only";
import { runAlpaca } from "@/lib/alpaca";
import { listBots } from "@/lib/settings";
import type { AlpacaPosition } from "@/lib/types/alpaca";

/** Alpaca order shape with the fields we need for attribution.
 *  We intentionally widen the canonical AlpacaOrder type rather than
 *  modifying it — those fields aren't used elsewhere in the dashboard. */
export type AlpacaOrderForAttribution = {
  id?: string;
  client_order_id?: string;
  symbol: string;
  side: "buy" | "sell";
  qty: string;
  filled_qty?: string;
  filled_avg_price?: string;
  filled_at?: string | null;
  created_at?: string;
  status: string;
};

export type BotPosition = {
  symbol: string;
  qty: number;
  avgEntryPrice: number;
  currentPrice: number;
  marketValue: number;
  costBasis: number;
  unrealizedPl: number;
  unrealizedPlpc: number;
};

// ─── Per-account caches (audit P4) ──────────────────────────────────────
// The leaderboard fans out one botEquity() per bot. Without caching, N bots
// sharing one account = N alpaca shell-outs each for orders + positions on
// every poll. TTL matches the 30s leaderboard refresh interval, so the
// first bot pays the cost and the rest hit cache.

const ACCOUNT_CACHE_TTL_MS = 25_000;

type CacheEntry<T> = { value: T; expiresAt: number };

declare global {
  // eslint-disable-next-line no-var
  var __perAccountOrders: Map<string, CacheEntry<AlpacaOrderForAttribution[]>> | undefined;
  // eslint-disable-next-line no-var
  var __perAccountPositions: Map<string, CacheEntry<AlpacaPosition[]>> | undefined;
  // eslint-disable-next-line no-var
  var __perAccountOrdersInflight: Map<string, Promise<AlpacaOrderForAttribution[]>> | undefined;
  // eslint-disable-next-line no-var
  var __perAccountPositionsInflight: Map<string, Promise<AlpacaPosition[]>> | undefined;
}

function ordersCache(): Map<string, CacheEntry<AlpacaOrderForAttribution[]>> {
  if (!globalThis.__perAccountOrders) globalThis.__perAccountOrders = new Map();
  return globalThis.__perAccountOrders;
}
function positionsCache(): Map<string, CacheEntry<AlpacaPosition[]>> {
  if (!globalThis.__perAccountPositions) globalThis.__perAccountPositions = new Map();
  return globalThis.__perAccountPositions;
}
function ordersInflight(): Map<string, Promise<AlpacaOrderForAttribution[]>> {
  if (!globalThis.__perAccountOrdersInflight) globalThis.__perAccountOrdersInflight = new Map();
  return globalThis.__perAccountOrdersInflight;
}
function positionsInflight(): Map<string, Promise<AlpacaPosition[]>> {
  if (!globalThis.__perAccountPositionsInflight) globalThis.__perAccountPositionsInflight = new Map();
  return globalThis.__perAccountPositionsInflight;
}

/** Fetches the closed-order history for an account, cached per (accountId, after).
 *  Concurrent callers within the TTL share a single in-flight promise.
 *
 *  When `after` is set, the alpaca.sh `orders` subcommand passes it through
 *  to Alpaca's `/v2/orders?after=<iso>` filter so the response excludes fills
 *  predating that timestamp on the wire — important for high-volume accounts
 *  where the 500-row cap would otherwise drop older relevant fills (audit P4).
 *  Multi-bot callers should pass the EARLIEST bot's createdAt on the account
 *  so sibling bots share the same cached superset. */
export async function getAccountClosedOrders(
  accountId: string,
  after?: string
): Promise<AlpacaOrderForAttribution[]> {
  const cacheKey = `${accountId}::${after ?? ""}`;
  const now = Date.now();
  const hit = ordersCache().get(cacheKey);
  if (hit && hit.expiresAt > now) return hit.value;
  const pending = ordersInflight().get(cacheKey);
  if (pending) return pending;
  const args = after ? ["closed", `--after=${after}`] : ["closed"];
  const work = (async () => {
    try {
      const orders = (await runAlpaca("orders", args, {
        accountId,
      })) as AlpacaOrderForAttribution[];
      ordersCache().set(cacheKey, {
        value: orders,
        expiresAt: now + ACCOUNT_CACHE_TTL_MS,
      });
      return orders;
    } finally {
      ordersInflight().delete(cacheKey);
    }
  })();
  ordersInflight().set(cacheKey, work);
  return work;
}

/** Fetches the live open positions for an account, cached per accountId. */
export async function getAccountPositions(
  accountId: string
): Promise<AlpacaPosition[]> {
  const now = Date.now();
  const hit = positionsCache().get(accountId);
  if (hit && hit.expiresAt > now) return hit.value;
  const pending = positionsInflight().get(accountId);
  if (pending) return pending;
  const work = (async () => {
    try {
      const positions = (await runAlpaca("positions", [], {
        accountId,
      })) as AlpacaPosition[];
      positionsCache().set(accountId, {
        value: positions,
        expiresAt: now + ACCOUNT_CACHE_TTL_MS,
      });
      return positions;
    } finally {
      positionsInflight().delete(accountId);
    }
  })();
  positionsInflight().set(accountId, work);
  return work;
}

/** Manual cache invalidation hook — used by routes that mutate orders
 *  (submit-order, cancel) so the next read sees fresh data. The orders
 *  cache is keyed on `${accountId}::${after}`, so we sweep every entry
 *  whose key starts with the account prefix. */
export function invalidateAccountCaches(accountId: string): void {
  const prefix = `${accountId}::`;
  for (const key of ordersCache().keys()) {
    if (key.startsWith(prefix)) ordersCache().delete(key);
  }
  positionsCache().delete(accountId);
}

/** Parse the bot id from a tagged client_order_id of the form
 *  `${botId}-${ymd}-${nanoid}`. Returns null if the order isn't tagged
 *  with a known bot prefix. */
export function botIdFromClientOrderId(
  clientOrderId: string | undefined,
  knownBotIds: readonly string[]
): string | null {
  if (!clientOrderId) return null;
  // Sort longest-first so a bot id like "momentum-10k" wins over "momentum"
  // when both are registered.
  const sorted = [...knownBotIds].sort((a, b) => b.length - a.length);
  for (const id of sorted) {
    if (clientOrderId.startsWith(`${id}-`)) return id;
  }
  return null;
}

/** Returns the per-bot open positions for the given bot. Only meaningful
 *  for bots that have an `accountId` and (optionally) an `allocation` —
 *  for bots without allocation we still tag orders so the user can audit
 *  per-bot fills, but the equity math falls through to the raw account.
 *
 *  Algorithm: fetch all filled orders on the bot's account, attribute by
 *  client_order_id prefix, net buys/sells per symbol, then enrich with
 *  the current Alpaca position to get current price + unrealized P&L.
 *  Fills that happened before the bot was registered are excluded — a
 *  brand-new bot doesn't inherit historical attribution (audit A10). */
export async function getBotPositions(botId: string): Promise<BotPosition[]> {
  const bots = await listBots();
  const bot = bots.find((b) => b.id === botId);
  if (!bot) throw new Error(`Bot "${botId}" not found`);

  const sibBots = bots.filter((b) => b.accountId === bot.accountId);
  const knownBotIds = sibBots.map((b) => b.id);
  const botCreatedAtMs = Date.parse(bot.createdAt);

  // Pass the EARLIEST sibling-bot createdAt as `after` so all bots on the
  // same account share one cached order superset. Each bot still filters
  // client-side on its own createdAt below.
  const earliestSibCreatedAt = sibBots
    .map((b) => b.createdAt)
    .filter((s): s is string => Boolean(s))
    .sort()[0];

  const [orders, livePositions] = await Promise.all([
    getAccountClosedOrders(bot.accountId, earliestSibCreatedAt),
    getAccountPositions(bot.accountId),
  ]);

  // Net quantity + total cost basis per symbol, attributed to this bot.
  const netBySymbol = new Map<string, { qty: number; cost: number }>();
  for (const order of orders) {
    if (order.status !== "filled") continue;
    if (botIdFromClientOrderId(order.client_order_id, knownBotIds) !== botId) continue;
    // Drop fills predating the bot's registration. The `filled_at` field is
    // the canonical fill timestamp; fall back to `created_at` for safety.
    const filledAt = order.filled_at ?? order.created_at;
    if (filledAt && Number.isFinite(botCreatedAtMs)) {
      const filledAtMs = Date.parse(filledAt);
      if (Number.isFinite(filledAtMs) && filledAtMs < botCreatedAtMs) continue;
    }
    const filledQty = Number(order.filled_qty ?? order.qty);
    const filledPrice = Number(order.filled_avg_price ?? "0");
    if (!Number.isFinite(filledQty) || !Number.isFinite(filledPrice)) continue;
    const signedQty = order.side === "buy" ? filledQty : -filledQty;
    const signedCost = signedQty * filledPrice;
    const acc = netBySymbol.get(order.symbol) ?? { qty: 0, cost: 0 };
    acc.qty += signedQty;
    acc.cost += signedCost;
    netBySymbol.set(order.symbol, acc);
  }

  // Enrich with current price from the live positions feed. Symbols the
  // bot has fully exited (qty=0) drop out automatically.
  const currentPriceBySymbol = new Map(
    livePositions.map((p) => [p.symbol, Number(p.current_price)])
  );

  const out: BotPosition[] = [];
  for (const [symbol, { qty, cost }] of netBySymbol) {
    if (Math.abs(qty) < 1e-9) continue;
    const currentPrice = currentPriceBySymbol.get(symbol) ?? cost / qty;
    const avgEntryPrice = cost / qty;
    const marketValue = qty * currentPrice;
    const costBasis = qty * avgEntryPrice;
    const unrealizedPl = marketValue - costBasis;
    const unrealizedPlpc = costBasis === 0 ? 0 : unrealizedPl / Math.abs(costBasis);
    out.push({
      symbol,
      qty,
      avgEntryPrice,
      currentPrice,
      marketValue,
      costBasis,
      unrealizedPl,
      unrealizedPlpc,
    });
  }
  return out.sort((a, b) => b.marketValue - a.marketValue);
}
