import { NextResponse } from "next/server";
import { getStrategy } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _req: Request,
  context: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await context.params;
    const strategy = await getStrategy(slug);
    if (!strategy) {
      return NextResponse.json(
        { error: `Strategy "${slug}" not found` },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { strategy },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
