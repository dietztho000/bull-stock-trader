"use client";

import useSWR from "swr";
import { Badge } from "@/components/ui/Card";

const fetcher = (u: string) => fetch(u).then((r) => r.json());

type Clock = { is_open: boolean; next_open: string; next_close: string };

export function MarketClock() {
  const { data } = useSWR<Clock | { error: string }>(
    "/api/alpaca/clock",
    fetcher,
    { refreshInterval: 30000 }
  );
  if (!data || "error" in data)
    return <Badge tone="neutral">Market: unknown</Badge>;
  const c = data as Clock;
  if (c.is_open)
    return (
      <Badge tone="up">
        Market open · closes {new Date(c.next_close).toLocaleTimeString([], {
          hour: "numeric",
          minute: "2-digit",
        })}
      </Badge>
    );
  return (
    <Badge tone="warn">
      Market closed · opens{" "}
      {new Date(c.next_open).toLocaleString([], {
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
      })}
    </Badge>
  );
}
