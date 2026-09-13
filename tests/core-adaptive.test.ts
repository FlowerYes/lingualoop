import { describe, expect, it } from 'vitest';
import { calculateComprehension } from '../lib/adaptive';
import { addSavedWord, applyWatchEvent, createLearner } from '../lib/learner';
import type { SavedWord, WatchEvent } from '../lib/types';

const watch = (patch: Partial<WatchEvent> = {}): WatchEvent => ({
  videoId: 'one', completionRatio: 1, wordTaps: 0,
  translationOpened: false, replayed: false, savedWords: 0, ...patch,
});

describe('comprehension scoring', () => {
  it.each([[0, 0.55], [0.8, 0.55], [0.81, 0.75], [0.95, 0.75], [0.96, 0.85]])(
    'scores completion %s at the exact threshold', (completionRatio, expected) => {
      expect(calculateComprehension(watch({ completionRatio }))).toBeCloseTo(expected);
    },
  );

  it('applies capped assistance penalties without penalizing saved words', () => {
    expect(calculateComprehension(watch({ wordTaps: 9, translationOpened: true, replayed: true, savedWords: 5 }))).toBeCloseTo(0.47);
    expect(calculateComprehension(watch({ completionRatio: 0.8, wordTaps: 5, translationOpened: true, replayed: true }))).toBeCloseTo(0.17);
  });

  it('handles malformed numeric input and always returns a bounded score', () => {
    expect(calculateComprehension(watch({ completionRatio: NaN, wordTaps: NaN }))).toBeCloseTo(0.55);
    expect(calculateComprehension(watch({ completionRatio: 10, wordTaps: -5 }))).toBeCloseTo(0.85);
  });
});

describe('learner updates', () => {
  it('creates an independent, bounded initial learner', () => {
    expect(createLearner('es', 9, ['food', 'food', ' travel '])).toMatchObject({ ability: 5, interests: ['food', 'travel'] });
    expect(createLearner('Spanish', NaN, []).ability).toBe(1);
    expect(createLearner('Spanish', 1, []).language).toBe('es');
  });

  it('tracks actual watch seconds but does not score tiny interactions', () => {
    const initial = createLearner('es', 1, []);
    const result = applyWatchEvent(initial, watch({ completionRatio: 0.1 }), 2.4);
    expect(result.learner.totalWatchSeconds).toBe(2.4);
    expect(result.learner.comprehensionHistory).toEqual([]);
    expect(result.learner.watchedVideoIds).toEqual([]);
    expect(result.learner.ability).toBe(1);
    expect(result.message).toBeNull();
    expect(initial.totalWatchSeconds).toBe(0);
  });

  it('requires three unique completed observations and adjusts by 0.15', () => {
    let learner = createLearner('es', 1, []);
    learner = applyWatchEvent(learner, watch({ videoId: 'one' }), 12).learner;
    learner = applyWatchEvent(learner, watch({ videoId: 'two' }), 13).learner;
    expect(learner.ability).toBe(1);
    const result = applyWatchEvent(learner, watch({ videoId: 'three' }), 14);
    expect(result.learner.ability).toBe(1.15);
    expect(result.learner.totalWatchSeconds).toBe(39);
    expect(result.message).toContain('Increasing difficulty');
  });

  it('scores an 80%-completed video but never scores a video twice', () => {
    const first = applyWatchEvent(createLearner('es', 2, []), watch({ completionRatio: 0.8 }), 8);
    const replay = applyWatchEvent(first.learner, watch(), 10);
    expect(first.learner.comprehensionHistory).toEqual([0.55]);
    expect(replay.learner.comprehensionHistory).toEqual([0.55]);
    expect(replay.learner.watchedVideoIds).toEqual(['one']);
    expect(replay.learner.totalWatchSeconds).toBe(18);
    expect(replay.message).toBeNull();
  });

  it('uses only the five most recent scores, and clamps ability at either end', () => {
    const learner = { ...createLearner('es', 2, []), comprehensionHistory: [...Array(10).fill(0.85), ...Array(4).fill(0.17)] };
    const result = applyWatchEvent(learner, watch({ completionRatio: 0.8, wordTaps: 5, translationOpened: true, replayed: true }), 8);
    expect(result.learner.ability).toBe(1.85);
    expect(result.message).toContain('Slowing things down');
    const max = applyWatchEvent({ ...learner, ability: 5, comprehensionHistory: [0.85, 0.85] }, watch(), 10);
    expect(max.learner.ability).toBe(5);
    expect(max.message).toBeNull();
    const min = applyWatchEvent({ ...learner, ability: 1, comprehensionHistory: [0.17, 0.17] }, watch({ completionRatio: 0.8, wordTaps: 5, translationOpened: true, replayed: true }), 8);
    expect(min.learner.ability).toBe(1);
    expect(min.message).toBeNull();
  });

  it('ignores invalid elapsed time and caps retained score history', () => {
    const learner = { ...createLearner('es', 2, []), comprehensionHistory: Array(30).fill(0.55) };
    const result = applyWatchEvent(learner, watch(), NaN);
    expect(result.learner.totalWatchSeconds).toBe(0);
    expect(result.learner.comprehensionHistory).toHaveLength(30);
    expect(applyWatchEvent(learner, watch(), -10).learner.totalWatchSeconds).toBe(0);
  });

  it('does not change ability or show a message when the rolling average is exactly 75%', () => {
    const learner = { ...createLearner('es', 2.345, []), comprehensionHistory: [0.75, 0.75] };
    const result = applyWatchEvent(learner, watch({ completionRatio: 0.95 }), 9.5);
    expect(result.learner.ability).toBe(2.345);
    expect(result.message).toBeNull();
  });

  it('deduplicates saved lemmas by language and increments encounters', () => {
    const word: SavedWord = { id: 'word-1', surface: 'Casas', lemma: 'casa', translation: 'house', contextSentence: 'Las casas son bonitas.', encounters: 1, language: 'es', videoId: 'one', savedAt: '2026-09-12T00:00:00.000Z' };
    const initial = addSavedWord(createLearner('es', 1, []), word);
    const duplicate = addSavedWord(initial, { ...word, id: 'word-2', lemma: ' CASA ', language: 'Spanish' });
    expect(duplicate.savedWords).toHaveLength(1);
    expect(duplicate.savedWords[0].encounters).toBe(2);
    expect(duplicate.savedWords[0].id).toBe('word-1');
    expect(initial.savedWords[0].encounters).toBe(1);
    expect(addSavedWord(duplicate, { ...word, id: 'word-3', language: 'it' }).savedWords).toHaveLength(2);
  });
});
