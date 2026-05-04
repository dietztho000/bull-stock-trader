import { todayInCT } from "@/lib/time";

export type SeasonalOutfit =
  | "halloween"
  | "thanksgiving"
  | "christmas"
  | "newyear"
  | null;

export const SEASONAL_LABEL: Record<NonNullable<SeasonalOutfit>, string> = {
  halloween: "Spooky szn",
  thanksgiving: "Thanksgiving",
  christmas: "Holiday cheer",
  newyear: "New year, new gains",
};

/** Returns the seasonal outfit for a given CT date (defaults to today). */
export function seasonalOutfitFor(dateStr: string = todayInCT()): SeasonalOutfit {
  const m = dateStr.slice(5, 7);
  const d = Number(dateStr.slice(8, 10));
  if (!Number.isFinite(d)) return null;
  switch (m) {
    case "10":
      return d >= 28 ? "halloween" : null;
    case "11":
      return d >= 22 && d <= 28 ? "thanksgiving" : null;
    case "12":
      return d >= 24 && d <= 26 ? "christmas" : null;
    case "01":
      return d === 1 ? "newyear" : null;
    default:
      return null;
  }
}
