import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLearner } from '../lib/learner';
import { cacheExplanation, EXPLANATION_STORAGE_KEY, getCachedExplanation, getExplanationKey, LEARNER_STORAGE_KEY, loadLearner, resetStorage, saveLearner, STORAGE_PREFIX, STORAGE_VERSION } from '../lib/storage';
import type { WordExplanation } from '../lib/types';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() { return values.size; },
    clear: () => values.clear(), getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => { values.delete(key); },
    setItem: (key, value) => { values.set(key, String(value)); },
  };
}

let storage: Storage;
beforeEach(() => {
  storage = memoryStorage();
  vi.stubGlobal('window', { localStorage: storage });
});
afterEach(() => vi.unstubAllGlobals());

describe('guarded learner persistence', () => {
  it('round-trips a learner in a versioned envelope', () => {
    const learner = createLearner('es', 2.15, ['travel']);
    learner.totalWatchSeconds = 37.4;
    learner.comprehensionHistory = [0.55, 0.85];
    expect(saveLearner(learner)).toBe(true);
    expect(loadLearner()).toEqual(learner);
    expect(JSON.parse(storage.getItem(LEARNER_STORAGE_KEY)!).version).toBe(STORAGE_VERSION);
  });

  it('clamps recoverable values, drops invalid vocabulary, and deduplicates ids', () => {
    storage.setItem(LEARNER_STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, state: { ...createLearner('es', 2, []), ability: 99, totalWatchSeconds: -2, watchedVideoIds: ['one', 'one', 2], comprehensionHistory: [-1, 0.5, 2, 'bad'], savedWords: [{ id: 'broken' }] } }));
    expect(loadLearner()).toMatchObject({ ability: 5, totalWatchSeconds: 0, watchedVideoIds: ['one'], comprehensionHistory: [0, 0.5, 1], savedWords: [] });
  });

  it.each(['{broken', 'null', '[]', JSON.stringify({ version: 999, state: {} }), JSON.stringify({ version: STORAGE_VERSION, state: { ability: 'wrong' } })])('recovers from corrupt or incompatible storage', (raw) => {
    storage.setItem(LEARNER_STORAGE_KEY, raw);
    expect(loadLearner()).toBeNull();
    expect(storage.getItem(LEARNER_STORAGE_KEY)).toBeNull();
  });

  it('is safe during server rendering and when browser storage is denied', () => {
    vi.stubGlobal('window', undefined);
    expect(loadLearner()).toBeNull();
    expect(saveLearner(createLearner('es', 1, []))).toBe(false);
    expect(() => resetStorage()).not.toThrow();
    vi.stubGlobal('window', { get localStorage() { throw new Error('Denied'); } });
    expect(loadLearner()).toBeNull();
    expect(saveLearner(createLearner('es', 1, []))).toBe(false);
    expect(() => cacheExplanation('key', explanation)).not.toThrow();
    expect(getCachedExplanation('key')).toBeNull();
    expect(() => resetStorage()).not.toThrow();
  });

  it('returns false on quota errors and resets only app-owned keys, including prior versions', () => {
    const originalSet = storage.setItem;
    storage.setItem = () => { throw new Error('Quota exceeded'); };
    expect(saveLearner(createLearner('es', 1, []))).toBe(false);
    storage.setItem = originalSet;
    storage.setItem('unrelated:setting', 'keep');
    storage.setItem(`${STORAGE_PREFIX}v0:learner`, 'old');
    saveLearner(createLearner('es', 1, []));
    cacheExplanation('word', explanation);
    resetStorage();
    expect(storage.length).toBe(1);
    expect(storage.getItem('unrelated:setting')).toBe('keep');
  });
});

const explanation: WordExplanation = { lemma: 'casa', translation: 'house', contextMeaning: 'A home.', explanation: 'A feminine noun.', example: 'Mi casa es pequeña.' };

describe('contextual explanation cache', () => {
  it('uses unambiguous language/word/context keys and round-trips answers', () => {
    const key = getExplanationKey('Spanish', ' Casa ', ' Mi   casa. ');
    expect(key).toBe(getExplanationKey('es', 'casa', 'Mi casa.'));
    expect(key).not.toBe(getExplanationKey('es', 'casa', 'Otra casa.'));
    cacheExplanation(key, explanation);
    expect(getCachedExplanation(key)).toEqual(explanation);
    expect(getCachedExplanation('missing')).toBeNull();
  });

  it('recovers from corruption and rejects invalid cached answers', () => {
    storage.setItem(EXPLANATION_STORAGE_KEY, '{broken');
    expect(getCachedExplanation('key')).toBeNull();
    cacheExplanation('key', explanation);
    expect(getCachedExplanation('key')).toEqual(explanation);
    storage.setItem(EXPLANATION_STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, entries: { key: { lemma: 'casa' } } }));
    expect(getCachedExplanation('key')).toBeNull();
  });
});
