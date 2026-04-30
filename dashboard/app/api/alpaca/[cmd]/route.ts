import { NextResponse } from "next/server";
import { isAllowedAlpacaCmd, runAlpaca } from "@/lib/alpaca";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ cmd: string }> }
) {
  const { cmd } = await params;
  if (!isAllowedAlpacaCmd(cmd)) {
    return NextResponse.json({ error: `unknown cmd: ${cmd}` }, { status: 400 });
  }
  try {
    const data = await runAlpaca(cmd);
    return NextResponse.json(data);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
