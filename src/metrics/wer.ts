function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\u0900-\u097f\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function editDistance(a: string[], b: string[]): number {
  const rows = a.length + 1;
  const cols = b.length + 1;
  const dp: number[] = new Array(cols);
  for (let j = 0; j < cols; j += 1) dp[j] = j;
  for (let i = 1; i < rows; i += 1) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j < cols; j += 1) {
      const temp = dp[j];
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + cost);
      prev = temp;
    }
  }
  return dp[cols - 1];
}

export function errorRate(hypothesis: string, reference: string): { wer: number; cer: number } {
  const hyp = normalize(hypothesis);
  const ref = normalize(reference);
  const hypWords = hyp ? hyp.split(' ') : [];
  const refWords = ref ? ref.split(' ') : [];
  const wer = refWords.length === 0 ? (hypWords.length === 0 ? 0 : 1) : editDistance(hypWords, refWords) / refWords.length;
  const cer = ref.length === 0 ? (hyp.length === 0 ? 0 : 1) : editDistance(hyp.split(''), ref.split('')) / ref.length;
  return { wer, cer };
}

/** Pick the reference script that the hypothesis matches more closely. */
export function bestError(hypothesis: string, references: string[]): { wer: number; cer: number; reference: string } {
  let best = { wer: 1, cer: 1, reference: references[0] ?? '' };
  for (const reference of references) {
    const score = errorRate(hypothesis, reference);
    if (score.cer < best.cer) best = { ...score, reference };
  }
  return best;
}
