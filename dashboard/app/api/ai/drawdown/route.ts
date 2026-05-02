import { getDrawdownNarrative } from "@/lib/ai/drawdown";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const result = await getDrawdownNarrative();
  if ("error" in result) {
    return Response.json(result, { status: 500 });
  }
  return Response.json(result);
}
