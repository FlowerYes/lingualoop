import { calculateComprehension } from './adaptive';
import type { LearnerState, SavedWord, WatchEvent } from './types';

const HISTORY_LIMIT = 30;
const RECENT_WINDOW = 5;
const MIN_OBSERVATIONS = 3;
export const LEARNING_INTERESTS = [
  'food',
  'travel',
  'culture',
  'everyday',
  'nature',
  'music',
] as const;

function languageCode(language: string): string {
  const value = language.trim().toLowerCase();
  return ['spanish', 'español', 'espanol', 'es'].includes(value) ? 'es' : value || 'es';
}

function clampAbility(ability: number): number {
  return Number.isFinite(ability) ? Math.max(1, Math.min(5, ability)) : 1;
}

export function createLearner(
  language: string,
  ability: number,
  interests: string[],
): LearnerState {
  return {
    language: languageCode(language),
    ability: clampAbility(ability),
    interests: [
      ...new Set(interests.map((interest) => interest.trim().toLowerCase()).filter(Boolean)),
    ],
    savedWords: [],
    watchedVideoIds: [],
    totalWatchSeconds: 0,
    comprehensionHistory: [],
  };
}

/** A deliberate level choice starts a fresh adaptation window, preserving earned progress. */
export function updateLearnerSettings(
  learner: LearnerState,
  ability: number,
  interests: string[],
): LearnerState {
  const allowed = new Set<string>(LEARNING_INTERESTS);
  const cleanInterests = (values: string[]) =>
    Array.isArray(values)
      ? [
          ...new Set(
            values
              .filter((interest): interest is string => typeof interest === 'string')
              .map((interest) => interest.trim().toLowerCase())
              .filter((interest) => allowed.has(interest)),
          ),
        ]
      : [];
  const selected = cleanInterests(interests);
  return {
    ...learner,
    ability: Number.isFinite(ability) ? clampAbility(ability) : clampAbility(learner.ability),
    interests: selected.length ? selected : cleanInterests(learner.interests),
    comprehensionHistory: [],
  };
}

export function adjustLearnerDifficulty(
  learner: LearnerState,
  direction: 'easier' | 'harder',
): LearnerState {
  if (direction !== 'easier' && direction !== 'harder') return learner;
  const change = direction === 'easier' ? -0.25 : 0.25;
  const ability = Math.round((clampAbility(learner.ability) + change) * 100) / 100;
  return updateLearnerSettings(learner, ability, learner.interests);
}

export function addSavedWord(learner: LearnerState, word: SavedWord): LearnerState {
  const lemma = (word.lemma || word.surface).trim().toLowerCase();
  const language = languageCode(word.language);
  const match = learner.savedWords.findIndex(
    (saved) =>
      saved.lemma.trim().toLowerCase() === lemma && languageCode(saved.language) === language,
  );
  if (match !== -1) {
    return {
      ...learner,
      savedWords: learner.savedWords.map((saved, index) =>
        index === match
          ? {
              ...saved,
              encounters: Math.min(Number.MAX_SAFE_INTEGER, Math.max(1, saved.encounters) + 1),
            }
          : saved,
      ),
    };
  }
  return {
    ...learner,
    savedWords: [
      ...learner.savedWords,
      {
        ...word,
        lemma,
        language,
        encounters: Number.isFinite(word.encounters) ? Math.max(1, Math.floor(word.encounters)) : 1,
      },
    ],
  };
}

/** Call once when leaving a video, passing elapsed playback time since the last call. */
export function applyWatchEvent(
  learner: LearnerState,
  event: WatchEvent,
  watchedSeconds: number,
): { learner: LearnerState; message: string | null } {
  const seconds = Number.isFinite(watchedSeconds) ? Math.max(0, watchedSeconds) : 0;
  const next: LearnerState = {
    ...learner,
    ability: clampAbility(learner.ability),
    totalWatchSeconds: Math.min(Number.MAX_SAFE_INTEGER, learner.totalWatchSeconds + seconds),
  };
  // A video counts once after meaningful completion; replay time still contributes to stats.
  if (
    !event.videoId ||
    !Number.isFinite(event.completionRatio) ||
    event.completionRatio < 0.8 ||
    learner.watchedVideoIds.includes(event.videoId)
  ) {
    return { learner: next, message: null };
  }
  next.watchedVideoIds = [...learner.watchedVideoIds, event.videoId];
  next.comprehensionHistory = [
    ...learner.comprehensionHistory,
    calculateComprehension(event),
  ].slice(-HISTORY_LIMIT);
  if (next.comprehensionHistory.length < MIN_OBSERVATIONS) return { learner: next, message: null };

  const recent = next.comprehensionHistory.slice(-RECENT_WINDOW);
  const average = recent.reduce((total, score) => total + score, 0) / recent.length;
  const delta = average > 0.75 ? 0.15 : average < 0.4 ? -0.15 : 0;
  if (delta === 0) return { learner: next, message: null };
  const adjusted = clampAbility(Math.round((next.ability + delta) * 100) / 100);
  if (adjusted === next.ability) return { learner: next, message: null };
  next.ability = adjusted;
  return {
    learner: next,
    message:
      delta > 0
        ? "You're flying through these. Increasing difficulty slightly."
        : 'Finding your level. Slowing things down a little.',
  };
}
