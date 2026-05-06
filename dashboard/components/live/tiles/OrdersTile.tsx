import { Card } from "@/components/ui/Card";
import { LiveOrders } from "@/components/live/LiveOrders";
import type { AlpacaScope } from "@/lib/alpacaMode";

export function OrdersTile({ scope }: { scope: AlpacaScope }) {
  return (
    <Card title="Open orders" subtitle="Trailing stops, limits, etc.">
      <LiveOrders scope={scope} />
    </Card>
  );
}
