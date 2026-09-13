import type { LearnerState, SavedWord, WordExplanation } from './types';

export const STORAGE_PREFIX = 'lingualoop:';
export const STORAGE_VERSION = 1;
export const LEARNER_STORAGE_KEY = `${STORAGE_PREFIX}v${STORAGE_VERSION}:learner`;
export const EXPLANATION_STORAGE_KEY = `${STORAGE_PREFIX}v${STORAGE_VERSION}:explanations`;
const CACHE_LIMIT = 200;

function browserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizedLanguage(language: string): string {
  const value = language.trim().toLowerCase();
  return ['spanish', 'español', 'espanol', 'es'].includes(value) ? 'es' : value;
}

function strings(value: unknown): string[] {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean))]
    : [];
}

function boundedNumber(value: unknown, min: number, max: number, fallback = min): number {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
}

function savedWord(value: unknown): SavedWord | null {
  if (!record(value)) return null;
  const required = ['id', 'surface', 'lemma', 'translation', 'contextSentence', 'language', 'videoId', 'savedAt'] as const;
  if (!required.every((key) => typeof value[key] === 'string' && value[key].trim().length > 0)) return null;
  return {
    id: value.id as string,
    surface: value.surface as string,
    lemma: (value.lemma as string).trim().toLowerCase(),
    translation: value.translation as string,
    contextSentence: value.contextSentence as string,
    language: normalizedLanguage(value.language as string),
    videoId: value.videoId as string,
    savedAt: value.savedAt as string,
    encounters: Math.floor(boundedNumber(value.encounters, 1, Number.MAX_SAFE_INTEGER)),
  };
}

function validatedLearner(value: unknown): LearnerState | null {
  if (!record(value) || typeof value.language !== 'string' || !value.language.trim()
    || typeof value.ability !== 'number' || !Number.isFinite(value.ability)) return null;
  const words = new Map<string, SavedWord>();
  if (Array.isArray(value.savedWords)) {
    for (const item of value.savedWords) {
      const word = savedWord(item);
      if (!word) continue;
      const key = JSON.stringify([word.language, word.lemma]);
      const existing = words.get(key);
      if (existing) existing.encounters = Math.max(existing.encounters, word.encounters);
      else words.set(key, word);
    }
  }
  return {
    language: normalizedLanguage(value.language),
    ability: boundedNumber(value.ability, 1, 5),
    interests: [...new Set(strings(value.interests).map((interest) => interest.toLowerCase()))],
    savedWords: [...words.values()],
    watchedVideoIds: strings(value.watchedVideoIds),
    totalWatchSeconds: boundedNumber(value.totalWatchSeconds, 0, Number.MAX_SAFE_INTEGER),
    comprehensionHistory: Array.isArray(value.comprehensionHistory)
      ? value.comprehensionHistory.filter((score): score is number => typeof score === 'number' && Number.isFinite(score))
        .map((score) => boundedNumber(score, 0, 1)).slice(-30)
      : [],
  };
}

function removeCorrupt(storage: Storage, key: string): null {
  try { storage.removeItem(key); } catch { /* Storage can be unavailable in private browsing. */ }
  return null;
}

export function loadLearner(): LearnerState | null {
  const storage = browserStorage();
  if (!storage) return null;
  try {
    const raw = storage.getItem(LEARNER_STORAGE_KEY);
    if (!raw) return null;
    const envelope: unknown = JSON.parse(raw);
    if (!record(envelope) || envelope.version !== STORAGE_VERSION) return removeCorrupt(storage, LEARNER_STORAGE_KEY);
    const learner = validatedLearner(envelope.state);
    if (!learner) return removeCorrupt(storage, LEARNER_STORAGE_KEY);
    return learner;
  } catch {
    return removeCorrupt(storage, LEARNER_STORAGE_KEY);
  }
}

export function saveLearner(state: LearnerState): boolean {
  const storage = browserStorage();
  if (!storage) return false;
  try {
    const learner = validatedLearner(state);
    if (!learner) return false;
    storage.setItem(LEARNER_STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, state: learner }));
    return true;
  } catch {
    return false;
  }
}

export function resetStorage(): void {
  const storage = browserStorage();
  if (!storage) return;
  try {
    const keys: string[] = [];
    for (let index = 0; index < storage.length; index++) {
      const key = storage.key(index);
      if (key?.startsWith(STORAGE_PREFIX)) keys.push(key);
    }
    for (const key of keys) storage.removeItem(key);
  } catch { /* A blocked storage API must not prevent the in-memory demo reset. */ }
}

export function getExplanationKey(language: string, word: string, sentence: string): string {
  return JSON.stringify([
    normalizedLanguage(language),
    word.trim().toLowerCase(),
    sentence.trim().replace(/\s+/g, ' '),
  ]);
}

function validatedExplanation(value: unknown): WordExplanation | null {
  if (!record(value)) return null;
  const fields = ['lemma', 'translation', 'contextMeaning', 'explanation', 'example'] as const;
  if (!fields.every((field) => typeof value[field] === 'string' && value[field].trim().length > 0)) return null;
  return Object.fromEntries(fields.map((field) => [field, value[field]])) as unknown as WordExplanation;
}

function explanationEntries(storage: Storage): Record<string, WordExplanation> {
  const entries: Record<string, WordExplanation> = Object.create(null);
  try {
    const raw = storage.getItem(EXPLANATION_STORAGE_KEY);
    if (!raw) return entries;
    const envelope: unknown = JSON.parse(raw);
    if (!record(envelope) || envelope.version !== STORAGE_VERSION || !record(envelope.entries)) {
      removeCorrupt(storage, EXPLANATION_STORAGE_KEY);
      return entries;
    }
    for (const [key, value] of Object.entries(envelope.entries).slice(-CACHE_LIMIT)) {
      const explanation = validatedExplanation(value);
      if (explanation) entries[key] = explanation;
    }
  } catch { removeCorrupt(storage, EXPLANATION_STORAGE_KEY); }
  return entries;
}

export function getCachedExplanation(key: string): WordExplanation | null {
  const storage = browserStorage();
  if (!storage) return null;
  return explanationEntries(storage)[key] ?? null;
}

export function cacheExplanation(key: string, value: WordExplanation): void {
  const storage = browserStorage();
  if (!storage) return;
  try {
    const explanation = validatedExplanation(value);
    if (!explanation) return;
    const entries = explanationEntries(storage);
    delete entries[key];
    entries[key] = explanation;
    const boundedEntries = Object.fromEntries(Object.entries(entries).slice(-CACHE_LIMIT));
    storage.setItem(EXPLANATION_STORAGE_KEY, JSON.stringify({ version: STORAGE_VERSION, entries: boundedEntries }));
  } catch { /* Caching is opportunistic; definitions still work when storage is full. */ }
}
