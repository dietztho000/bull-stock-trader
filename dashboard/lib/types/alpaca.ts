/**
 * Canonical Alpaca response shapes used by the dashboard.
 *
 * Alpaca returns most numerics as strings (e.g. "10042.51"). We keep them as
 * strings here to match the wire format and let consumers `Number(...)` them
 * once at the point of use.
 *
 * These are intentionally narrow — they cover only the fields the dashboard
 * actually reads. Add new fields here rather than redefining inline types in
 * components.
 */

/** Generic error envelope returned by `/api/alpaca/[cmd]` on failure. */
export type AlpacaErrorEnvelope = { error: string };

export type AlpacaAccount = {
  account_number?: string;
  equity: string;
  last_equity: string;
  cash: string;
  buying_power: string;
  daytrade_count: number;
  portfolio_value: string;
};

export type AlpacaPosition = {
  symbol: string;
  qty: string;
  avg_entry_price: string;
  current_price: string;
  market_value: string;
  unrealized_pl: string;
  unrealized_plpc: string;
};

export type AlpacaOrder = {
  id?: string;
  symbol: string;
  side: string;
  qty: string;
  type: string;
  trail_percent?: string;
  limit_price?: string;
  stop_price?: string;
  status: string;
};

export type AlpacaClock = {
  is_open?: boolean;
  next_open?: string;
  next_close?: string;
};

/** True when the response is the `{ error }` envelope rather than data. */
export function isAlpacaError<T>(
  resp: T | AlpacaErrorEnvelope | null | undefined
): resp is AlpacaErrorEnvelope {
  return Boolean(resp) && typeof resp === "object" && resp !== null && "error" in resp;
}
