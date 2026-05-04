import { NextResponse } from "next/server";
import { z } from "zod";
import { runAlpaca } from "@/lib/alpaca";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Validate an Alpaca credential set BEFORE persisting it. The dashboard
 *  POSTs proposed creds here; the route forwards them in-memory through
 *  runAlpaca's `rawCreds` path — they never touch the encrypted vault and
 *  no settings record is staged. Avoids the previous race window where
 *  two simultaneous test calls could observe each other's staged accounts.
 *
 *  The route lives under `/[id]/test` for URL clarity, but the `id` param
 *  is ignored for the test-pre-create flow (the body carries the keys). */

const testBody = z.object({
  endpoint: z.string().url(),
  apiKey: z.string().min(1),
  secretKey: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const body = testBody.parse(await req.json());
    const result = (await runAlpaca("account", [], {
      rawCreds: {
        endpoint: body.endpoint,
        apiKey: body.apiKey,
        secretKey: body.secretKey,
        mode: body.endpoint.includes("paper-api") ? "paper" : "live",
      },
    })) as {
      account_number?: string;
      status?: string;
    };
    return NextResponse.json({
      ok: true,
      accountNumber: result.account_number ?? null,
      status: result.status ?? null,
    });
  } catch (err) {
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : String(err) },
      { status: 200 }
    );
  }
}
