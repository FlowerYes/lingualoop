export type WatchedRange = [number, number];
export type PlaybackEvidence = {
  ranges: WatchedRange[];
  wordTaps: number;
  translationOpened: boolean;
  replayed: boolean;
};
export type GesturePoint = { x: number; y: number; time: number };

export function clampSeek(time: number, duration: number): number {
  if (!Number.isFinite(time) || !Number.isFinite(duration) || duration <= 0) return 0;
  return Math.max(0, Math.min(time, duration));
}

/** The browser retains vertical scrolling; only deliberate horizontal swipes act. */
export function classifyPlaybackGesture(
  start: GesturePoint,
  end: GesturePoint,
): 'tap' | 'swipe-left' | 'swipe-right' | 'cancel' {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const elapsed = end.time - start.time;
  if (![dx, dy, elapsed].every(Number.isFinite) || elapsed < 0) return 'cancel';
  if (Math.hypot(dx, dy) <= 10 && elapsed <= 400) return 'tap';
  if (elapsed <= 750 && Math.abs(dx) >= 48 && Math.abs(dx) > Math.abs(dy) * 1.5)
    return dx < 0 ? 'swipe-left' : 'swipe-right';
  return 'cancel';
}

/** Wall seconds and the corresponding footage, excluding seeks and stale samples. */
export function playbackCredit(
  previousTime: number,
  currentTime: number,
  elapsedSeconds: number,
  playbackRate: number,
  seeking: boolean,
): { seconds: number; range?: WatchedRange } {
  const delta = currentTime - previousTime;
  if (
    seeking ||
    ![previousTime, currentTime, elapsedSeconds, playbackRate].every(Number.isFinite) ||
    previousTime < 0 ||
    elapsedSeconds <= 0 ||
    elapsedSeconds > 2 ||
    playbackRate <= 0 ||
    delta <= 0 ||
    delta > elapsedSeconds * playbackRate + 0.15
  )
    return { seconds: 0 };
  const seconds = Math.min(delta / playbackRate, elapsedSeconds);
  return { seconds, range: [currentTime - seconds * playbackRate, currentTime] };
}

/** Merge played intervals so rewinding never counts the same footage twice. */
export function addWatchedRange(
  ranges: readonly WatchedRange[],
  range: WatchedRange,
  duration: number,
): WatchedRange[] {
  if (!range.every(Number.isFinite)) return ranges.map(([start, end]) => [start, end]);
  const start = clampSeek(range[0], duration);
  const end = clampSeek(range[1], duration);
  if (end <= start) return ranges.map(([from, to]) => [from, to]);
  const sorted = [...ranges, [start, end] as WatchedRange].sort((a, b) => a[0] - b[0]);
  const merged: WatchedRange[] = [];
  for (const [from, to] of sorted) {
    const last = merged[merged.length - 1];
    if (last && from <= last[1]) last[1] = Math.max(last[1], to);
    else merged.push([from, to]);
  }
  return merged;
}

export function watchedCompletion(ranges: readonly WatchedRange[], duration: number): number {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  const seconds = ranges.reduce((sum, [start, end]) => sum + Math.max(0, end - start), 0);
  return Math.min(1, seconds / duration);
}
