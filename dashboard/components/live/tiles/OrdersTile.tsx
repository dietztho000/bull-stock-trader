import { Card } from "@/components/ui/Card";
import { LiveOrders } from "@/components/live/LiveOrders";
import type { AlpacaMode } from "@/lib/alpacaMode";

export function OrdersTile({
  mode,
  accountId,
}: { mode: AlpacaMode; accountId?: string | null }) {
  return (
    <Card title="Open orders" subtitle="Trailing stops, limits, etc.">
      <LiveOrders mode={mode} accountId={accountId} />
    </Card>
  );
}
