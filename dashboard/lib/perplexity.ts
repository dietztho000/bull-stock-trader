import { spawn } from "node:child_process";
import path from "node:path";
import { BOT_ROOT } from "./memoryPath";
import { z } from "zod";
import {
  type EconomicEvent,
  type EconomicImportance,
  normalizeImportance,
} from "./parsers/economicCalendar.shared";
import type { EarningsEntry } from "./parsers/earningsCalendar.shared";

export type PerplexityResponse = {
  choices?: Array<{ message?: { content?: string } }>;
};

async function runPerplexity(
  query: string,
  opts: { extraEnv?: NodeJS.ProcessEnv } = {}
): Promise<PerplexityResponse> {
  const script = path.join(BOT_ROOT, "scripts", "perplexity.sh");
  return new Promise((resolve, reject) => {
    const proc = spawn("bash", [script, query], {
      cwd: BOT_ROOT,
      env: { ...process.env, ...opts.extraEnv },
    });
    let stdout = "";
    let stderr = "";
    proc.stdout.on("data", (d) => (stdout += d.toString()));
    proc.stderr.on("data", (d) => (stderr += d.toString()));
    proc.on("close", (code) => {
      if (code === 3) {
        reject(new Error("PERPLEXITY_API_KEY not set"));
        return;
      }
      if (code !== 0) {
        reject(new Error(`perplexity.sh exited ${code}: ${stderr.trim().slice(0, 240)}`));
        return;
      }
      try {
        resolve(JSON.parse(stdout) as PerplexityResponse);
      } catch (err) {
        reject(new Error(`perplexity.sh: invalid JSON: ${stdout.slice(0, 240)}`));
      }
    });
    proc.on("error", reject);
  });
}

const economicEventSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().default(""),
  event: z.string().min(1),
  importance: z.string().default(""),
  forecast: z.union([z.string(), z.number(), z.null()]).optional(),
  previous: z.union([z.string(), z.number(), z.null()]).optional(),
});

const economicEventArraySchema = z.array(economicEventSchema);

function extractJsonArray(text: string): unknown {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("[");
  const end = candidate.lastIndexOf("]");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("no JSON array found in Perplexity response");
  }
  const slice = candidate.slice(start, end + 1);
  return JSON.parse(slice);
}

function fmtCell(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  return String(v).trim();
}

export async function fetchEconomicCalendar(
  opts: { days?: number; today?: string } = {}
): Promise<EconomicEvent[]> {
  const days = opts.days ?? 14;
  const today =
    opts.today ??
    (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    })();

  const query = [
    `List all scheduled US economic events for the next ${days} calendar days starting ${today}.`,
    "For each event return: date (YYYY-MM-DD), time (Eastern, HH:MM 24h), event name (e.g. CPI YoY, FOMC Minutes, Initial Jobless Claims, Nonfarm Payrolls), importance (high|medium|low), forecast value (string), previous value (string).",
    'Output ONLY a JSON array, no prose, no citations. Example: [{"date":"2026-05-02","time":"08:30","event":"Initial Jobless Claims","importance":"medium","forecast":"215K","previous":"212K"}]',
  ].join(" ");

  const resp = await runPerplexity(query);
  const text = resp.choices?.[0]?.message?.content ?? "";
  if (!text.trim()) {
    throw new Error("empty Perplexity response");
  }

  const parsed = extractJsonArray(text);
  const validated = economicEventArraySchema.parse(parsed);

  const events: EconomicEvent[] = validated.map((row) => ({
    date: row.date,
    time: row.time?.trim() ?? "",
    event: row.event.trim(),
    importance: normalizeImportance(row.importance ?? "") as EconomicImportance,
    forecast: fmtCell(row.forecast),
    previous: fmtCell(row.previous),
    source: "Perplexity",
    refreshed: today,
  }));

  return events;
}

function normalizeBmoAmc(raw: string): "BMO" | "AMC" | "" {
  const v = raw.trim().toUpperCase();
  if (v === "BMO" || v === "AMC") return v;
  if (/before/i.test(raw)) return "BMO";
  if (/after/i.test(raw)) return "AMC";
  return "";
}

/**
 * Curated list of mega-cap / market-mover tickers whose earnings prints
 * meaningfully move the broader market. Bulk "list all S&P 500 earnings"
 * queries against Perplexity Sonar return empty for forward windows
 * (web search doesn't surface aggregated earnings calendars), so we
 * fan out per-ticker — the same pattern the bot uses successfully for
 * its per-ticker EARNINGS-CALENDAR.md cache.
 */
// REVAMPED 2026-05-06: expanded from 36 → ~110 tickers covering most of the
// S&P 100 plus the high-volume mid-caps that move broad-tape sentiment.
// Ticker order is curated (Mag 7 first, then sector-grouped) so per-ticker
// concurrency fan-out doesn't bunch up requests for one Perplexity sub-query.
export const MAJOR_TICKERS: Array<{ symbol: string; company: string }> = [
  // Magnificent 7
  { symbol: "NVDA", company: "NVIDIA" },
  { symbol: "AAPL", company: "Apple" },
  { symbol: "MSFT", company: "Microsoft" },
  { symbol: "AMZN", company: "Amazon" },
  { symbol: "GOOGL", company: "Alphabet" },
  { symbol: "META", company: "Meta Platforms" },
  { symbol: "TSLA", company: "Tesla" },
  // Mega-cap tech / semis / SaaS
  { symbol: "AVGO", company: "Broadcom" },
  { symbol: "ORCL", company: "Oracle" },
  { symbol: "CRM", company: "Salesforce" },
  { symbol: "ADBE", company: "Adobe" },
  { symbol: "NFLX", company: "Netflix" },
  { symbol: "AMD", company: "Advanced Micro Devices" },
  { symbol: "INTC", company: "Intel" },
  { symbol: "QCOM", company: "Qualcomm" },
  { symbol: "TXN", company: "Texas Instruments" },
  { symbol: "MU", company: "Micron Technology" },
  { symbol: "AMAT", company: "Applied Materials" },
  { symbol: "LRCX", company: "Lam Research" },
  { symbol: "KLAC", company: "KLA Corporation" },
  { symbol: "NOW", company: "ServiceNow" },
  { symbol: "SNOW", company: "Snowflake" },
  { symbol: "PLTR", company: "Palantir Technologies" },
  { symbol: "PANW", company: "Palo Alto Networks" },
  { symbol: "CRWD", company: "CrowdStrike" },
  { symbol: "INTU", company: "Intuit" },
  { symbol: "IBM", company: "IBM" },
  { symbol: "CSCO", company: "Cisco Systems" },
  { symbol: "UBER", company: "Uber Technologies" },
  // Big banks / financials
  { symbol: "JPM", company: "JPMorgan Chase" },
  { symbol: "BAC", company: "Bank of America" },
  { symbol: "WFC", company: "Wells Fargo" },
  { symbol: "GS", company: "Goldman Sachs" },
  { symbol: "MS", company: "Morgan Stanley" },
  { symbol: "C", company: "Citigroup" },
  { symbol: "BLK", company: "BlackRock" },
  { symbol: "SCHW", company: "Charles Schwab" },
  { symbol: "AXP", company: "American Express" },
  { symbol: "PYPL", company: "PayPal" },
  // Payments / fintech
  { symbol: "V", company: "Visa" },
  { symbol: "MA", company: "Mastercard" },
  // Retail / consumer discretionary
  { symbol: "WMT", company: "Walmart" },
  { symbol: "COST", company: "Costco" },
  { symbol: "HD", company: "Home Depot" },
  { symbol: "LOW", company: "Lowe's" },
  { symbol: "TGT", company: "Target" },
  { symbol: "NKE", company: "Nike" },
  { symbol: "MCD", company: "McDonald's" },
  { symbol: "SBUX", company: "Starbucks" },
  { symbol: "BKNG", company: "Booking Holdings" },
  { symbol: "ABNB", company: "Airbnb" },
  { symbol: "F", company: "Ford Motor" },
  { symbol: "GM", company: "General Motors" },
  // Consumer staples
  { symbol: "PG", company: "Procter & Gamble" },
  { symbol: "KO", company: "Coca-Cola" },
  { symbol: "PEP", company: "PepsiCo" },
  { symbol: "PM", company: "Philip Morris International" },
  { symbol: "MO", company: "Altria" },
  { symbol: "MDLZ", company: "Mondelez" },
  // Energy
  { symbol: "XOM", company: "ExxonMobil" },
  { symbol: "CVX", company: "Chevron" },
  { symbol: "COP", company: "ConocoPhillips" },
  { symbol: "OXY", company: "Occidental Petroleum" },
  { symbol: "SLB", company: "Schlumberger" },
  // Healthcare / pharma / biotech
  { symbol: "JNJ", company: "Johnson & Johnson" },
  { symbol: "UNH", company: "UnitedHealth" },
  { symbol: "LLY", company: "Eli Lilly" },
  { symbol: "PFE", company: "Pfizer" },
  { symbol: "ABBV", company: "AbbVie" },
  { symbol: "MRK", company: "Merck" },
  { symbol: "TMO", company: "Thermo Fisher Scientific" },
  { symbol: "ABT", company: "Abbott Laboratories" },
  { symbol: "DHR", company: "Danaher" },
  { symbol: "BMY", company: "Bristol-Myers Squibb" },
  { symbol: "AMGN", company: "Amgen" },
  { symbol: "GILD", company: "Gilead Sciences" },
  { symbol: "CVS", company: "CVS Health" },
  // Industrials / aerospace / transports
  { symbol: "BA", company: "Boeing" },
  { symbol: "CAT", company: "Caterpillar" },
  { symbol: "DE", company: "Deere & Company" },
  { symbol: "GE", company: "GE Aerospace" },
  { symbol: "HON", company: "Honeywell" },
  { symbol: "RTX", company: "RTX Corporation" },
  { symbol: "LMT", company: "Lockheed Martin" },
  { symbol: "UPS", company: "United Parcel Service" },
  { symbol: "FDX", company: "FedEx" },
  { symbol: "UNP", company: "Union Pacific" },
  // Communications / media
  { symbol: "DIS", company: "Disney" },
  { symbol: "T", company: "AT&T" },
  { symbol: "VZ", company: "Verizon Communications" },
  { symbol: "CMCSA", company: "Comcast" },
  // Materials / chemicals
  { symbol: "LIN", company: "Linde" },
  // Real estate / utilities (high-volume names)
  { symbol: "PLD", company: "Prologis" },
  { symbol: "AMT", company: "American Tower" },
  { symbol: "NEE", company: "NextEra Energy" },
  // Conglomerates / payments
  { symbol: "BRK.B", company: "Berkshire Hathaway" },
  // High-volume mid-caps that move sentiment
  { symbol: "COIN", company: "Coinbase" },
  { symbol: "SHOP", company: "Shopify" },
  { symbol: "MSTR", company: "Strategy" },
  { symbol: "ARM", company: "Arm Holdings" },
  { symbol: "MRVL", company: "Marvell Technology" },
  { symbol: "DELL", company: "Dell Technologies" },
  { symbol: "SMCI", company: "Super Micro Computer" },
  { symbol: "DDOG", company: "Datadog" },
  { symbol: "NET", company: "Cloudflare" },
  { symbol: "ZS", company: "Zscaler" },
  { symbol: "SQ", company: "Block" },
  { symbol: "ROKU", company: "Roku" },
  { symbol: "RIVN", company: "Rivian" },
];

const earningsAnswerSchema = z.object({
  date: z.union([
    z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    z.string().regex(/^none-\d+d?$/i),
    z.literal(""),
  ]),
  type: z.string().default(""),
  epsEstimate: z.union([z.string(), z.number(), z.null()]).optional(),
});

async function fetchOneEarnings(
  symbol: string,
  company: string,
  today: string
): Promise<EarningsEntry | null> {
  const query = [
    `When is the next earnings report for ${symbol} (${company})?`,
    `Return ONLY a JSON object — no prose, no citations — with these fields:`,
    `{"date": "YYYY-MM-DD" or "" if unknown or > 90 days away,`,
    ` "type": "BMO" (before market open) or "AMC" (after market close) or "",`,
    ` "epsEstimate": consensus EPS forecast string with $ prefix (e.g. "$1.87") or ""}`,
    `Today is ${today}.`,
  ].join(" ");

  let resp: PerplexityResponse;
  try {
    resp = await runPerplexity(query);
  } catch {
    return null;
  }
  const text = resp.choices?.[0]?.message?.content ?? "";
  if (!text.trim()) return null;

  const obj = extractJsonObject(text);
  if (!obj) return null;
  const parsed = earningsAnswerSchema.safeParse(obj);
  if (!parsed.success) return null;

  const date = parsed.data.date;
  if (!date || /^none/i.test(date)) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  return {
    symbol,
    date,
    type: normalizeBmoAmc(parsed.data.type ?? ""),
    source: "Perplexity",
    refreshed: today,
    company,
    epsEstimate: fmtCell(parsed.data.epsEstimate),
  };
}

function extractJsonObject(text: string): unknown | null {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function runWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const idx = cursor++;
      results[idx] = await fn(items[idx]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker));
  return results;
}

export async function fetchMarketEarnings(
  opts: { days?: number; today?: string; tickers?: Array<{ symbol: string; company: string }> } = {}
): Promise<EarningsEntry[]> {
  const days = opts.days ?? 30;
  const today =
    opts.today ??
    (() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    })();
  const tickers = opts.tickers ?? MAJOR_TICKERS;

  const horizon = (() => {
    const m = today.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return today;
    const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  // REVAMPED 2026-05-06: bumped concurrency 5 → 8 to keep wall-time bounded
  // now that the curated list is ~110 tickers (was 36). Perplexity's per-key
  // rate limit is generous; the script-level cache de-duplicates same-day
  // re-queries across runs so this is also safe under retry.
  const raw = await runWithConcurrency(tickers, 8, ({ symbol, company }) =>
    fetchOneEarnings(symbol, company, today)
  );

  const inWindow = raw
    .filter((e): e is EarningsEntry => e !== null)
    .filter((e) => e.date >= today && e.date <= horizon);

  inWindow.sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.symbol.localeCompare(b.symbol);
  });
  return inWindow;
}

// NEW 2026-05-06: post-print results fetcher. Given a list of (symbol, date)
// pairs whose earnings prints are in the past, query Perplexity for the
// actual EPS and the next-trading-day percentage move. The
// refresh-earnings-results routine collects these and back-fills the
// MARKET-EARNINGS.md table via writeEarningsResults().
const earningsResultSchema = z.object({
  actualEps: z.union([z.string(), z.number(), z.null()]).optional(),
  postPrintMovePct: z.union([z.string(), z.number(), z.null()]).optional(),
});

async function fetchOneEarningsResult(
  symbol: string,
  date: string
): Promise<{ symbol: string; date: string; actualEps?: string; postPrintMovePct?: string } | null> {
  const query = [
    `For ${symbol}'s earnings reported on ${date}:`,
    `Return ONLY a JSON object — no prose, no citations:`,
    `{"actualEps": "$X.XX" or "" if unknown,`,
    ` "postPrintMovePct": "+X.X%" or "-X.X%" — the percentage change in the stock`,
    `   on the next trading session after the print, with sign,`,
    `   or "" if the next session has not yet closed.}`,
  ].join(" ");

  let resp: PerplexityResponse;
  try {
    resp = await runPerplexity(query);
  } catch {
    return null;
  }
  const text = resp.choices?.[0]?.message?.content ?? "";
  if (!text.trim()) return null;

  const obj = extractJsonObject(text);
  if (!obj) return null;
  const parsed = earningsResultSchema.safeParse(obj);
  if (!parsed.success) return null;

  const actualEps = fmtCell(parsed.data.actualEps);
  const postPrintMovePct = fmtCell(parsed.data.postPrintMovePct);
  if (!actualEps && !postPrintMovePct) return null;
  return { symbol, date, actualEps, postPrintMovePct };
}

export async function fetchEarningsResults(
  rows: Array<{ symbol: string; date: string }>
): Promise<
  Array<{ symbol: string; date: string; actualEps?: string; postPrintMovePct?: string }>
> {
  const fetched = await runWithConcurrency(rows, 6, ({ symbol, date }) =>
    fetchOneEarningsResult(symbol, date)
  );
  return fetched.filter(
    (r): r is { symbol: string; date: string; actualEps?: string; postPrintMovePct?: string } =>
      r !== null
  );
}
