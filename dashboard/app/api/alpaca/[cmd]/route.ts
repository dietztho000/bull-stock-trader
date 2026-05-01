import { NextResponse } from "next/server";
import { isAllowedAlpacaCmd, runAlpaca, type AlpacaMode } from "@/lib/alpaca";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

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
  if (rawMode !== null && parseMode(rawMode) === undefined) {
    return NextResponse.json(
      { error: `mode must be 'paper' or 'live' (got '${rawMode}')` },
      { status: 400 }
    );
  }
  const mode = parseMode(rawMode);
  try {
    const data = await runAlpaca(cmd, [], { mode });
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
