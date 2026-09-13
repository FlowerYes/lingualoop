'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  addSavedWord,
  adjustLearnerDifficulty,
  applyWatchEvent,
  createLearner,
  updateLearnerSettings,
} from '@/lib/learner';
import { loadLearner, resetStorage, saveLearner } from '@/lib/storage';
import {
  clearMobilePreferences,
  DEFAULT_MOBILE_PREFERENCES,
  loadMobilePreferences,
  mergeMobilePreferences,
  saveMobilePreferences,
  type MobilePreferences,
} from '@/lib/mobile-preferences';
import { videos } from '@/data/videos';
import type { LearnerState, SavedWord, WatchEvent } from '@/lib/types';
import { addWatchedRange, type PlaybackEvidence } from '@/lib/playback';

export type FeedSession = {
  activeId: string | null;
  visitedIds: string[];
  timeByVideoId: Record<string, number>;
  evidenceByVideoId: Record<string, PlaybackEvidence>;
};
const emptyFeedSession = (): FeedSession => ({
  activeId: null,
  visitedIds: [],
  timeByVideoId: {},
  evidenceByVideoId: {},
});
const videoDurations = new Map(videos.map((video) => [video.id, video.duration]));

type LearnerContextValue = {
  learner: LearnerState | null;
  ready: boolean;
  persistenceError: boolean;
  toast: { text: string; id: number } | null;
  notify: (text: string) => void;
  dismissToast: () => void;
  onboard: (ability: number, interests: string[]) => void;
  saveWord: (word: SavedWord) => void;
  recordWatch: (event: WatchEvent, seconds: number) => void;
  preferences: MobilePreferences;
  updatePreferences: (patch: Partial<MobilePreferences>) => void;
  toggleLike: (videoId: string) => void;
  updateLearning: (ability: number, interests: string[]) => void;
  adjustDifficulty: (direction: 'easier' | 'harder') => void;
  feedSession: FeedSession;
  updateFeedSession: (patch: Partial<FeedSession>) => void;
  reset: () => void;
};
const LearnerContext = createContext<LearnerContextValue | null>(null);
const subscribe = () => () => {};

export function LearnerProvider({ children }: { children: React.ReactNode }) {
  const ready = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
  const [learner, setLearner] = useState<LearnerState | null>(() => loadLearner());
  const [learnerPersistenceError, setLearnerPersistenceError] = useState(false);
  const [preferencesPersistenceError, setPreferencesPersistenceError] = useState(false);
  const [preferences, setPreferences] = useState<MobilePreferences>(() => loadMobilePreferences());
  const [feedSession, setFeedSession] = useState<FeedSession>(emptyFeedSession);
  const [toast, setToast] = useState<{ text: string; id: number } | null>(null);
  const current = useRef(learner);
  const currentPreferences = useRef(preferences);
  const notify = useCallback((text: string) => setToast({ text, id: Date.now() }), []);
  const commit = useCallback((next: LearnerState) => {
    current.current = next;
    setLearner(next);
    setLearnerPersistenceError(!saveLearner(next));
  }, []);
  const updatePreferences = useCallback((patch: Partial<MobilePreferences>) => {
    const next = mergeMobilePreferences(currentPreferences.current, patch);
    currentPreferences.current = next;
    setPreferences(next);
    setPreferencesPersistenceError(!saveMobilePreferences(next));
  }, []);
  const toggleLike = useCallback(
    (videoId: string) => {
      if (!videoDurations.has(videoId)) return;
      const ids = currentPreferences.current.likedVideoIds;
      updatePreferences({
        likedVideoIds: ids.includes(videoId)
          ? ids.filter((id) => id !== videoId)
          : [...ids, videoId],
      });
    },
    [updatePreferences],
  );
  const updateLearning = useCallback(
    (ability: number, interests: string[]) => {
      if (current.current) commit(updateLearnerSettings(current.current, ability, interests));
    },
    [commit],
  );
  const adjustDifficulty = useCallback(
    (direction: 'easier' | 'harder') => {
      if (current.current) commit(adjustLearnerDifficulty(current.current, direction));
    },
    [commit],
  );
  const updateFeedSession = useCallback((patch: Partial<FeedSession>) => {
    if (!current.current) return;
    setFeedSession((previous) => {
      const positions = { ...previous.timeByVideoId };
      if (patch.timeByVideoId) {
        for (const [id, time] of Object.entries(patch.timeByVideoId)) {
          const duration = videoDurations.get(id);
          if (duration !== undefined && Number.isFinite(time))
            positions[id] = Math.max(0, Math.min(duration, time));
        }
      }
      const next: FeedSession = {
        evidenceByVideoId: { ...previous.evidenceByVideoId },
        activeId:
          patch.activeId === null ||
          (typeof patch.activeId === 'string' && videoDurations.has(patch.activeId))
            ? patch.activeId
            : previous.activeId,
        visitedIds: Array.isArray(patch.visitedIds)
          ? [...new Set(patch.visitedIds.filter((id) => videoDurations.has(id)))].slice(
              0,
              videoDurations.size,
            )
          : previous.visitedIds,
        timeByVideoId: positions,
      };
      for (const [id, evidence] of Object.entries(patch.evidenceByVideoId || {})) {
        const duration = videoDurations.get(id);
        if (duration === undefined) continue;
        next.evidenceByVideoId[id] = {
          ranges: evidence.ranges.reduce(
            (ranges, range) => addWatchedRange(ranges, range, duration),
            [] as PlaybackEvidence['ranges'],
          ),
          wordTaps: Math.max(0, Math.floor(evidence.wordTaps)),
          translationOpened: evidence.translationOpened,
          replayed: evidence.replayed,
        };
      }
      if (
        next.activeId === previous.activeId &&
        next.visitedIds.length === previous.visitedIds.length &&
        next.visitedIds.every((id, index) => id === previous.visitedIds[index]) &&
        Object.keys(positions).length === Object.keys(previous.timeByVideoId).length &&
        Object.entries(positions).every(([id, time]) => time === previous.timeByVideoId[id]) &&
        JSON.stringify(next.evidenceByVideoId) === JSON.stringify(previous.evidenceByVideoId)
      )
        return previous;
      return next;
    });
  }, []);
  useEffect(() => {
    if (preferences.theme === 'system') document.documentElement.removeAttribute('data-theme');
    else document.documentElement.setAttribute('data-theme', preferences.theme);
  }, [preferences.theme]);
  const onboard = useCallback(
    (ability: number, interests: string[]) => commit(createLearner('es', ability, interests)),
    [commit],
  );
  const saveWord = useCallback(
    (word: SavedWord) => {
      if (current.current) commit(addSavedWord(current.current, word));
    },
    [commit],
  );
  const recordWatch = useCallback(
    (event: WatchEvent, seconds: number) => {
      if (!current.current) return;
      const result = applyWatchEvent(current.current, event, seconds);
      commit(result.learner);
      if (result.message) notify(result.message);
    },
    [commit, notify],
  );
  const reset = useCallback(() => {
    resetStorage();
    clearMobilePreferences();
    current.current = null;
    const defaults = mergeMobilePreferences(DEFAULT_MOBILE_PREFERENCES, {});
    currentPreferences.current = defaults;
    setPreferences(defaults);
    setFeedSession(emptyFeedSession());
    setLearner(null);
    setToast(null);
    setLearnerPersistenceError(false);
    setPreferencesPersistenceError(false);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 6500);
    return () => clearTimeout(timer);
  }, [toast]);
  return (
    <LearnerContext.Provider
      value={{
        learner,
        ready,
        persistenceError: learnerPersistenceError || preferencesPersistenceError,
        toast,
        notify,
        dismissToast: () => setToast(null),
        onboard,
        saveWord,
        recordWatch,
        preferences,
        updatePreferences,
        toggleLike,
        updateLearning,
        adjustDifficulty,
        feedSession,
        updateFeedSession,
        reset,
      }}
    >
      {children}
    </LearnerContext.Provider>
  );
}

export function useLearner() {
  const context = useContext(LearnerContext);
  if (!context) throw new Error('useLearner must be used within LearnerProvider');
  return context;
}
