import { NextResponse } from "next/server";
import { generateVaultKey } from "@/lib/accountVault";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Returns a fresh 32-byte random key as base64. The dashboard surfaces it
 *  to the user so they can paste into `.env` as `BULL_VAULT_KEY=`. The route
 *  does NOT persist the key — that's the user's responsibility, since
 *  rotating mid-session would invalidate every existing encrypted credential
 *  blob. */
export async function POST() {
  return NextResponse.json(
    { key: generateVaultKey() },
    { headers: { "Cache-Control": "no-store" } }
  );
}
