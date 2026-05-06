"use client";

import { useMarketClock } from "./useMarketClock";

/** Thin alias over `useMarketClock` for callers that only need the open/closed
 *  flag. Kept as a separate hook so consumers stay focused — gating logic in
 *  `useLiveSwr` cares about `is_open`, not the next-close timestamp. */
export function useMarketIsOpen(): boolean | null {
  return useMarketClock().isOpen;
}
