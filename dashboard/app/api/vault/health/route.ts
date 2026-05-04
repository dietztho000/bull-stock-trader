import { NextResponse } from "next/server";
import { isVaultUsingFallback } from "@/lib/accountVault";
import { detectRekeyDrift, getRotationStatus } from "@/lib/vaultRekey";
import { loadSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const [drift, settings] = await Promise.all([detectRekeyDrift(), loadSettings()]);
  const rotation = await getRotationStatus(settings.vault.rotateEveryDays);
  return NextResponse.json(
    {
      usingFallback: isVaultUsingFallback(),
      // When `drifted: true`, the running process holds a stale master key
      // — every credential decrypt will fail until the user updates their
      // .env and restarts. The dashboard banner reads this to nudge them.
      rekeyDrift: drift,
      // Audit F2 — rotation cadence + overdue status. `dueInDays` is null
      // when no cadence is configured. Banner uses `overdue` to nudge.
      rotation,
    },
    { headers: { "Cache-Control": "no-store" } }
  );
}
