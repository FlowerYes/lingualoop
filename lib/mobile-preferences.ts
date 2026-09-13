import { videos } from '@/data/videos';

export type MobilePreferences = {
  muted: boolean;
  englishCaptions: boolean;
  playbackRate: number;
  likedVideoIds: string[];
  theme: 'system' | 'light' | 'dark';
};

export const MOBILE_PREFERENCES_KEY = 'lingualoop:mobile:v1';
export const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5] as const;
export const DEFAULT_MOBILE_PREFERENCES: MobilePreferences = {
  muted: true,
  englishCaptions: false,
  playbackRate: 1,
  likedVideoIds: [],
  theme: 'system',
};

const videoIds = new Set(videos.map((video) => video.id));

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function browserStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage;
  } catch {
    return null;
  }
}

/** Invalid fields leave the corresponding current preference unchanged. */
export function mergeMobilePreferences(
  current: MobilePreferences,
  patch: unknown,
): MobilePreferences {
  const input = isRecord(patch) ? patch : {};
  return {
    muted: typeof input.muted === 'boolean' ? input.muted : current.muted,
    englishCaptions:
      typeof input.englishCaptions === 'boolean' ? input.englishCaptions : current.englishCaptions,
    playbackRate:
      typeof input.playbackRate === 'number' &&
      PLAYBACK_RATES.some((rate) => rate === input.playbackRate)
        ? input.playbackRate
        : current.playbackRate,
    likedVideoIds: Array.isArray(input.likedVideoIds)
      ? [
          ...new Set(
            input.likedVideoIds.filter(
              (id): id is string => typeof id === 'string' && videoIds.has(id),
            ),
          ),
        ].slice(0, videoIds.size)
      : [...current.likedVideoIds],
    theme:
      input.theme === 'system' || input.theme === 'light' || input.theme === 'dark'
        ? input.theme
        : current.theme,
  };
}

export function loadMobilePreferences(): MobilePreferences {
  const defaults = () => mergeMobilePreferences(DEFAULT_MOBILE_PREFERENCES, {});
  const storage = browserStorage();
  if (!storage) return defaults();
  try {
    const raw = storage.getItem(MOBILE_PREFERENCES_KEY);
    if (!raw) return defaults();
    const record: unknown = JSON.parse(raw);
    if (!isRecord(record) || record.version !== 1 || !isRecord(record.preferences)) {
      clearMobilePreferences();
      return defaults();
    }
    return mergeMobilePreferences(DEFAULT_MOBILE_PREFERENCES, record.preferences);
  } catch {
    clearMobilePreferences();
    return defaults();
  }
}

export function saveMobilePreferences(preferences: MobilePreferences): boolean {
  const storage = browserStorage();
  if (!storage) return false;
  try {
    storage.setItem(
      MOBILE_PREFERENCES_KEY,
      JSON.stringify({
        version: 1,
        preferences: mergeMobilePreferences(DEFAULT_MOBILE_PREFERENCES, preferences),
      }),
    );
    return true;
  } catch {
    return false;
  }
}

export function clearMobilePreferences(): void {
  try {
    browserStorage()?.removeItem(MOBILE_PREFERENCES_KEY);
  } catch {
    // In-memory settings still reset if browser storage is unavailable.
  }
}
