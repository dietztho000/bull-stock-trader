import { Card } from "@/components/ui/Card";
import { LivePositions } from "@/components/live/LivePositions";
import type { AlpacaMode } from "@/lib/alpacaMode";
import type { EarningsEntry } from "@/lib/parsers/earningsCalendar";
import type { LadderState } from "@/lib/parsers/ladderProgress";

export function PositionsTile({
  mode,
  earnings,
  overnightGaps,
  ladder,
}: {
  mode: AlpacaMode;
  earnings?: Record<string, EarningsEntry>;
  overnightGaps?: Record<string, number | null>;
  ladder?: Record<string, LadderState>;
}) {
  return (
    <Card title="Positions" subtitle="Refreshes every 5s from Alpaca">
      <LivePositions
        mode={mode}
        earnings={earnings}
        overnightGaps={overnightGaps}
        ladder={ladder}
      />
    </Card>
  );
}
