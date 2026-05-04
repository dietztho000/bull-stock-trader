import { Card } from "@/components/ui/Card";
import { LivePositions } from "@/components/live/LivePositions";
import type { AlpacaMode } from "@/lib/alpacaMode";
import type { EarningsEntry } from "@/lib/parsers/earningsCalendar";
import type { LadderState } from "@/lib/parsers/ladderProgress";

export function PositionsTile({
  mode,
  accountId,
  earnings,
  overnightGaps,
  ladder,
}: {
  mode: AlpacaMode;
  accountId?: string | null;
  earnings?: Record<string, EarningsEntry>;
  overnightGaps?: Record<string, number | null>;
  ladder?: Record<string, LadderState>;
}) {
  return (
    <Card title="Positions" subtitle="Refreshes every 5s from Alpaca">
      <LivePositions
        mode={mode}
        accountId={accountId}
        earnings={earnings}
        overnightGaps={overnightGaps}
        ladder={ladder}
      />
    </Card>
  );
}
