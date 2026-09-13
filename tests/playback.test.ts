import { describe, expect, it } from 'vitest';
import {
  addWatchedRange,
  clampSeek,
  classifyPlaybackGesture,
  playbackCredit,
  watchedCompletion,
} from '../lib/playback';

describe('video seeking', () => {
  it('clamps rewinds and seeks to the finite media duration', () => {
    expect(clampSeek(-5, 20)).toBe(0);
    expect(clampSeek(40, 20)).toBe(20);
    expect(clampSeek(6.25, 20)).toBe(6.25);
    expect(clampSeek(NaN, 20)).toBe(0);
    expect(clampSeek(Infinity, 20)).toBe(0);
    expect(clampSeek(10, NaN)).toBe(0);
    expect(clampSeek(10, -2)).toBe(0);
  });
});

describe('playback gestures', () => {
  const start = { x: 100, y: 100, time: 0 };
  it('accepts a short tap with ordinary finger movement', () => {
    expect(classifyPlaybackGesture(start, { x: 104, y: 106, time: 160 })).toBe('tap');
  });
  it('opens the tutor on left swipes and transcript on right swipes', () => {
    expect(classifyPlaybackGesture(start, { x: 20, y: 112, time: 250 })).toBe('swipe-left');
    expect(classifyPlaybackGesture(start, { x: 180, y: 88, time: 250 })).toBe('swipe-right');
  });
  it('leaves vertical and diagonal feed scrolling alone', () => {
    expect(classifyPlaybackGesture(start, { x: 105, y: 240, time: 200 })).toBe('cancel');
    expect(classifyPlaybackGesture(start, { x: 170, y: 185, time: 200 })).toBe('cancel');
  });
  it('does not turn long presses, short drags, or invalid timing into taps', () => {
    expect(classifyPlaybackGesture(start, { x: 100, y: 100, time: 850 })).toBe('cancel');
    expect(classifyPlaybackGesture(start, { x: 124, y: 100, time: 200 })).toBe('cancel');
    expect(classifyPlaybackGesture(start, { x: 100, y: 100, time: -1 })).toBe('cancel');
  });
});

describe('truthful playback evidence', () => {
  it('credits real playing time at normal and reduced speeds', () => {
    expect(playbackCredit(2, 2.5, 0.5, 1, false)).toEqual({ seconds: 0.5, range: [2, 2.5] });
    expect(playbackCredit(2, 2.25, 0.5, 0.5, false)).toEqual({ seconds: 0.5, range: [2, 2.25] });
    expect(playbackCredit(2, 3, 0.5, 2, false)).toEqual({ seconds: 0.5, range: [2, 3] });
  });
  it('does not credit seek jumps, active seeking, loops, or stale background samples', () => {
    expect(playbackCredit(2, 18, 0.25, 1, false).seconds).toBe(0);
    expect(playbackCredit(2, 2.1, 0.25, 1, true).seconds).toBe(0);
    expect(playbackCredit(18, 0, 0.25, 1, false).seconds).toBe(0);
    expect(playbackCredit(2, 12, 10, 1, false).seconds).toBe(0);
    expect(playbackCredit(2, 3, NaN, 1, false).seconds).toBe(0);
    expect(playbackCredit(2, 3, 1, 0, false).seconds).toBe(0);
  });
  it('never credits more than elapsed wall time', () => {
    const credit = playbackCredit(2, 2.55, 0.5, 1, false);
    expect(credit.seconds).toBe(0.5);
    expect(credit.range).toBeDefined();
    if (credit.range) expect(credit.range[1] - credit.range[0]).toBeCloseTo(0.5);
  });
  it('counts unique played footage so replaying a fragment cannot manufacture completion', () => {
    let ranges = addWatchedRange([], [0, 3], 20);
    ranges = addWatchedRange(ranges, [1, 4], 20);
    ranges = addWatchedRange(ranges, [18, 20], 20);
    ranges = addWatchedRange(ranges, [18, 20], 20);
    expect(ranges).toEqual([
      [0, 4],
      [18, 20],
    ]);
    expect(watchedCompletion(ranges, 20)).toBeCloseTo(0.3);
  });
  it('merges adjacent intervals without mutating the previous evidence', () => {
    const ranges: [number, number][] = [
      [0, 2],
      [4, 6],
    ];
    expect(addWatchedRange(ranges, [2, 4], 10)).toEqual([[0, 6]]);
    expect(ranges).toEqual([
      [0, 2],
      [4, 6],
    ]);
  });
  it('bounds footage and rejects invalid ranges and duration', () => {
    expect(addWatchedRange([], [-2, 12], 10)).toEqual([[0, 10]]);
    expect(addWatchedRange([], [5, 2], 10)).toEqual([]);
    expect(addWatchedRange([], [NaN, 2], 10)).toEqual([]);
    expect(watchedCompletion([[0, 2]], 0)).toBe(0);
    expect(watchedCompletion([[0, 2]], NaN)).toBe(0);
  });
});
