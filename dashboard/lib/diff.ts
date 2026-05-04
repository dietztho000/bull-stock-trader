/** Tiny LCS-based line diff. The strategy file is short (~hundred lines),
 *  so we keep the implementation O(N×M) for clarity rather than pulling in
 *  a diff library. Output is full-file with markers — sufficient for modal
 *  previews and the strategy-compare page without the "find the actual
 *  change" friction of a stock unified diff with collapsed context. */

export type DiffLine = {
  /** "+" for added in target, "-" for removed from target, " " for context. */
  kind: "+" | "-" | " ";
  text: string;
};

export function diffLines(a: string, b: string): DiffLine[] {
  const aLines = a.split("\n");
  const bLines = b.split("\n");
  const m = aLines.length;
  const n = bLines.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));
  for (let i = m - 1; i >= 0; i--) {
    for (let j = n - 1; j >= 0; j--) {
      dp[i][j] =
        aLines[i] === bLines[j]
          ? dp[i + 1][j + 1] + 1
          : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < m && j < n) {
    if (aLines[i] === bLines[j]) {
      out.push({ kind: " ", text: aLines[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ kind: "-", text: aLines[i] });
      i++;
    } else {
      out.push({ kind: "+", text: bLines[j] });
      j++;
    }
  }
  while (i < m) out.push({ kind: "-", text: aLines[i++] });
  while (j < n) out.push({ kind: "+", text: bLines[j++] });
  return out;
}

export function summarizeDiff(lines: DiffLine[]): {
  added: number;
  removed: number;
  identical: boolean;
} {
  let added = 0;
  let removed = 0;
  for (const l of lines) {
    if (l.kind === "+") added++;
    else if (l.kind === "-") removed++;
  }
  return { added, removed, identical: added === 0 && removed === 0 };
}
