import { NextResponse } from "next/server";
import { isVaultUsingFallback } from "@/lib/accountVault";
import { detectRekeyDrift } from "@/lib/vaultRekey";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const drift = await detectRekeyDrift();
  return NextResponse.json(
    {
      usingFallback: isVaultUsingFallback(),
      // When `drifted: true`, the running process holds a stale master key
      // — every credential decrypt will fail until the user updates their
      // .env and restarts. The dashboard banner reads this to nudge them.
      rekeyDrift: drift,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
