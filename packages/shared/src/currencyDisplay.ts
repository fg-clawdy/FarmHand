export type CurrencyDisplay = {
  symbol: string;        // "★"
  noun: string;          // "stars"
  nounSingular: string;  // "star"
};

/** Cosmetized currency label. Backend canonical currency is always "points". */
export const CURRENCY_DISPLAY: CurrencyDisplay = {
  symbol: "★",
  noun: "stars",
  nounSingular: "star",
};

/** e.g. formatPoints(500) -> "500★" */
export function formatPoints(points: number): string {
  return `${points}${CURRENCY_DISPLAY.symbol}`;
}

/** e.g. formatPointsNoun(1) -> "1 star"; formatPointsNoun(500) -> "500 stars" */
export function formatPointsNoun(points: number): string {
  const noun = Math.abs(points) === 1 ? CURRENCY_DISPLAY.nounSingular : CURRENCY_DISPLAY.noun;
  return `${points} ${noun}`;
}
