import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { videos } from '../data/videos';
import {
  clearMobilePreferences,
  DEFAULT_MOBILE_PREFERENCES,
  loadMobilePreferences,
  mergeMobilePreferences,
  MOBILE_PREFERENCES_KEY,
  saveMobilePreferences,
} from '../lib/mobile-preferences';
import {
  addSavedWord,
  adjustLearnerDifficulty,
  createLearner,
  updateLearnerSettings,
} from '../lib/learner';
import { LEARNER_STORAGE_KEY, loadLearner, resetStorage, saveLearner } from '../lib/storage';

function memoryStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => [...values.keys()][index] ?? null,
    removeItem: (key) => {
      values.delete(key);
    },
    setItem: (key, value) => {
      values.set(key, String(value));
    },
  };
}

let storage: Storage;
beforeEach(() => {
  storage = memoryStorage();
  vi.stubGlobal('window', { localStorage: storage });
});
afterEach(() => vi.unstubAllGlobals());

describe('mobile preferences', () => {
  it('starts muted with immersion captions, normal speed, and system appearance', () => {
    expect(loadMobilePreferences()).toEqual({
      muted: true,
      englishCaptions: false,
      playbackRate: 1,
      likedVideoIds: [],
      theme: 'system',
    });
  });

  it('round-trips all settings independently of existing learning data', () => {
    const learner = createLearner('es', 2, ['travel']);
    saveLearner(learner);
    const preferences = mergeMobilePreferences(DEFAULT_MOBILE_PREFERENCES, {
      muted: false,
      englishCaptions: true,
      playbackRate: 0.75,
      likedVideoIds: [videos[0].id, videos[1].id],
      theme: 'dark',
    });
    expect(saveMobilePreferences(preferences)).toBe(true);
    expect(loadMobilePreferences()).toEqual(preferences);
    expect(loadLearner()).toEqual(learner);
    expect(JSON.parse(storage.getItem(MOBILE_PREFERENCES_KEY)!).version).toBe(1);
  });

  it.each(['{broken', 'null', '[]', JSON.stringify({ version: 2, preferences: {} })])(
    'recovers from corrupt or incompatible records',
    (raw) => {
      storage.setItem(MOBILE_PREFERENCES_KEY, raw);
      expect(loadMobilePreferences()).toEqual(DEFAULT_MOBILE_PREFERENCES);
      expect(storage.getItem(MOBILE_PREFERENCES_KEY)).toBeNull();
    },
  );

  it('rejects invalid fields while keeping valid recovered preferences', () => {
    storage.setItem(
      MOBILE_PREFERENCES_KEY,
      JSON.stringify({
        version: 1,
        preferences: {
          muted: 'false',
          englishCaptions: true,
          playbackRate: 99,
          theme: 'purple',
          likedVideoIds: [videos[0].id, videos[0].id, 'unknown', 8],
        },
      }),
    );
    expect(loadMobilePreferences()).toEqual({
      ...DEFAULT_MOBILE_PREFERENCES,
      englishCaptions: true,
      likedVideoIds: [videos[0].id],
    });
  });

  it('rejects invalid update values without resetting valid current choices', () => {
    const current = mergeMobilePreferences(DEFAULT_MOBILE_PREFERENCES, {
      playbackRate: 1.25,
      theme: 'light',
      muted: false,
    });
    expect(
      mergeMobilePreferences(current, { playbackRate: NaN, theme: 'wrong', muted: 'yes' }),
    ).toEqual(current);
    expect(mergeMobilePreferences(current, { playbackRate: 2 })).toEqual(current);
    expect(mergeMobilePreferences(current, { playbackRate: 1.5 }).playbackRate).toBe(1.5);
  });

  it('bounds liked IDs to unique clips in the current catalog and keeps defaults independent', () => {
    const ids = videos.flatMap((video) => [video.id, video.id, 'unknown']);
    const preferences = mergeMobilePreferences(DEFAULT_MOBILE_PREFERENCES, { likedVideoIds: ids });
    expect(preferences.likedVideoIds).toEqual(videos.map((video) => video.id));
    expect(preferences.likedVideoIds).toHaveLength(videos.length);
    preferences.likedVideoIds.push('not-a-real-video');
    expect(DEFAULT_MOBILE_PREFERENCES.likedVideoIds).toEqual([]);
    const first = loadMobilePreferences();
    first.likedVideoIds.push(videos[0].id);
    expect(loadMobilePreferences().likedVideoIds).toEqual([]);
  });

  it('safely handles server rendering, blocked storage, and quota failures', () => {
    vi.stubGlobal('window', undefined);
    expect(loadMobilePreferences()).toEqual(DEFAULT_MOBILE_PREFERENCES);
    expect(saveMobilePreferences(DEFAULT_MOBILE_PREFERENCES)).toBe(false);
    expect(() => clearMobilePreferences()).not.toThrow();
    vi.stubGlobal('window', {
      get localStorage() {
        throw new Error('Denied');
      },
    });
    expect(loadMobilePreferences()).toEqual(DEFAULT_MOBILE_PREFERENCES);
    expect(saveMobilePreferences(DEFAULT_MOBILE_PREFERENCES)).toBe(false);
    expect(() => clearMobilePreferences()).not.toThrow();
    vi.stubGlobal('window', { localStorage: storage });
    storage.setItem = () => {
      throw new Error('Quota');
    };
    expect(saveMobilePreferences(DEFAULT_MOBILE_PREFERENCES)).toBe(false);
  });

  it('clears only the preference key and supports the existing complete app reset', () => {
    saveLearner(createLearner('es', 2, ['food']));
    saveMobilePreferences({ ...DEFAULT_MOBILE_PREFERENCES, theme: 'dark' });
    storage.setItem('another-app:setting', 'keep');
    clearMobilePreferences();
    expect(storage.getItem(MOBILE_PREFERENCES_KEY)).toBeNull();
    expect(storage.getItem(LEARNER_STORAGE_KEY)).not.toBeNull();
    saveMobilePreferences(DEFAULT_MOBILE_PREFERENCES);
    resetStorage();
    expect(storage.getItem(MOBILE_PREFERENCES_KEY)).toBeNull();
    expect(storage.getItem(LEARNER_STORAGE_KEY)).toBeNull();
    expect(storage.getItem('another-app:setting')).toBe('keep');
  });
});

describe('learning settings', () => {
  const learnerWithProgress = () => ({
    ...addSavedWord(createLearner('es', 2.15, ['travel']), {
      id: 'es-casa',
      surface: 'casa',
      lemma: 'casa',
      translation: 'house',
      contextSentence: 'Mi casa.',
      encounters: 2,
      language: 'es',
      videoId: videos[0].id,
      savedAt: '2026-09-12T00:00:00.000Z',
    }),
    totalWatchSeconds: 180,
    watchedVideoIds: [videos[0].id],
    comprehensionHistory: [0.85, 0.75],
  });

  it('persists new level and interests without deleting progress or saved words', () => {
    const initial = learnerWithProgress();
    const updated = updateLearnerSettings(initial, 3, [
      ' Food ',
      'music',
      'food',
      'not-an-interest',
    ]);
    expect(updated).toEqual({
      ...initial,
      ability: 3,
      interests: ['food', 'music'],
      comprehensionHistory: [],
    });
    expect(initial.ability).toBe(2.15);
    expect(initial.comprehensionHistory).toEqual([0.85, 0.75]);
    expect(saveLearner(updated)).toBe(true);
    expect(loadLearner()).toEqual(updated);
  });

  it('clamps finite levels and preserves the current level or interests for invalid input', () => {
    const initial = learnerWithProgress();
    expect(updateLearnerSettings(initial, 99, ['food']).ability).toBe(5);
    expect(updateLearnerSettings(initial, -5, ['food']).ability).toBe(1);
    expect(updateLearnerSettings(initial, NaN, ['unknown']).ability).toBe(initial.ability);
    expect(updateLearnerSettings(initial, 2, []).interests).toEqual(initial.interests);
    expect(updateLearnerSettings(initial, 2, ['unknown']).interests).toEqual(initial.interests);
    expect(
      updateLearnerSettings({ ...initial, interests: ['unknown', 'travel'] }, 2, []).interests,
    ).toEqual(['travel']);
  });

  it('adjusts difficulty in quarter steps with bounds while preserving collection and totals', () => {
    const initial = learnerWithProgress();
    expect(adjustLearnerDifficulty(initial, 'easier')).toEqual({
      ...initial,
      ability: 1.9,
      comprehensionHistory: [],
    });
    expect(adjustLearnerDifficulty(initial, 'harder').ability).toBe(2.4);
    expect(adjustLearnerDifficulty({ ...initial, ability: 1 }, 'easier').ability).toBe(1);
    expect(adjustLearnerDifficulty({ ...initial, ability: 5 }, 'harder').ability).toBe(5);
  });
});
