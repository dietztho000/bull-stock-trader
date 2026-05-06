import { Card } from "@/components/ui/Card";
import { LivePositions } from "@/components/live/LivePositions";
import type { AlpacaScope } from "@/lib/alpacaMode";
import type { EarningsEntry } from "@/lib/parsers/earningsCalendar";
import type { LadderState } from "@/lib/parsers/ladderProgress";

export function PositionsTile({
  scope,
  earnings,
  overnightGaps,
  ladder,
}: {
  scope: AlpacaScope;
  earnings?: Record<string, EarningsEntry>;
  overnightGaps?: Record<string, number | null>;
  ladder?: Record<string, LadderState>;
}) {
  return (
    <Card title="Positions" subtitle="Refreshes every 5s from Alpaca">
      <LivePositions
        scope={scope}
        earnings={earnings}
        overnightGaps={overnightGaps}
        ladder={ladder}
      />
    </Card>
  );
}
