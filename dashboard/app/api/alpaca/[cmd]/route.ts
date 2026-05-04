import { NextResponse } from "next/server";
import { isAllowedAlpacaCmd, runAlpaca, type AlpacaMode } from "@/lib/alpaca";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/;

/** In-flight request dedupe (audit C3). When multiple concurrent requests
 *  hit /api/alpaca/account?accountId=foo (e.g. several browser tabs all
 *  refreshing at the 5s SWR tick), they all wait on the SAME shell-out
 *  Promise instead of spawning N child processes. We don't cache resolved
 *  results — Alpaca state is time-sensitive and stale ms can mean stale
 *  fills — so the entry is dropped the instant the underlying call settles.
 *  globalThis-scoped so it survives Next dev HMR module reloads. */
type InflightMap = Map<string, Promise<unknown>>;
declare global {
  // eslint-disable-next-line no-var
  var __alpacaInflight: InflightMap | undefined;
}
function inflight(): InflightMap {
  if (!globalThis.__alpacaInflight) globalThis.__alpacaInflight = new Map();
  return globalThis.__alpacaInflight;
}

function parseMode(raw: string | null): AlpacaMode | undefined {
  if (raw === "paper" || raw === "live") return raw;
  return undefined;
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ cmd: string }> }
) {
  const { cmd } = await params;
  if (!isAllowedAlpacaCmd(cmd)) {
    return NextResponse.json({ error: `unknown cmd: ${cmd}` }, { status: 400 });
  }
  const url = new URL(req.url);
  const rawMode = url.searchParams.get("mode");
  const rawAccountId = url.searchParams.get("accountId");

  // accountId wins over mode when both are set. Either-or is also fine —
  // omitting both falls through to the bot's default credentials (.env).
  if (rawAccountId !== null && !SLUG_RE.test(rawAccountId)) {
    return NextResponse.json(
      { error: `accountId must be a slug (got '${rawAccountId}')` },
      { status: 400 }
    );
  }
  if (rawMode !== null && parseMode(rawMode) === undefined) {
    return NextResponse.json(
      { error: `mode must be 'paper' or 'live' (got '${rawMode}')` },
      { status: 400 }
    );
  }
  const accountId = rawAccountId ?? undefined;
  const mode = parseMode(rawMode);
  // Refuse to fall through to the host's BOT_MODE env when the caller didn't
  // resolve an identity. Without this guard, a client component that hydrates
  // before the bot context is ready (mode === undefined) would silently query
  // whichever account .env happens to point at — see audit C2.
  if (!accountId && !mode) {
    return NextResponse.json(
      { error: "must provide ?accountId=<slug> or ?mode=paper|live" },
      { status: 400 }
    );
  }
  const key = `${cmd}|${accountId ?? `mode:${mode}`}`;
  const map = inflight();
  let promise = map.get(key);
  if (!promise) {
    promise = runAlpaca(cmd, [], accountId ? { accountId } : { mode }).finally(
      () => map.delete(key)
    );
    map.set(key, promise);
  }
  try {
    const data = await promise;
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
