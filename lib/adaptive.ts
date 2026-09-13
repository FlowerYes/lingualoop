import type { WatchEvent } from './types';

/** A deliberately small behavior heuristic, not a proficiency assessment. */
export function calculateComprehension(event: WatchEvent): number {
  const completion = Number.isFinite(event.completionRatio)
    ? Math.max(0, Math.min(1, event.completionRatio)) : 0;
  const taps = Number.isFinite(event.wordTaps) ? Math.max(0, event.wordTaps) : 0;
  let score = 0.55;
  if (completion > 0.8) score += 0.2;
  if (completion > 0.95) score += 0.1;
  if (event.translationOpened) score -= 0.1;
  score -= Math.min(taps * 0.04, 0.2);
  if (event.replayed) score -= 0.08;
  return Math.max(0, Math.min(1, score));
}
