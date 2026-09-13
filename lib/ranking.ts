import type { LearnerState, VideoItem } from './types';

function normalize(value: string): string {
  return value.trim().toLowerCase();
}

function languageCode(language: string): string {
  const value = normalize(language);
  return ['spanish', 'español', 'espanol', 'es'].includes(value) ? 'es' : value;
}

export function rankVideos(
  videos: VideoItem[],
  learner: LearnerState,
  options: { excludeIds?: string[]; random?: () => number } = {},
): VideoItem[] {
  const excluded = new Set(options.excludeIds ?? []);
  const watched = new Set(learner.watchedVideoIds);
  const interests = new Set(learner.interests.map(normalize));
  const language = languageCode(learner.language);
  const weakWords = new Set(learner.savedWords
    .filter((word) => word.encounters < 3 && languageCode(word.language) === language)
    .map((word) => normalize(word.lemma)));
  const ability = Number.isFinite(learner.ability) ? Math.max(1, Math.min(5, learner.ability)) : 1;
  const random = options.random ?? Math.random;
  const included = new Set<string>();

  return videos
    .filter((video) => {
      if (excluded.has(video.id) || included.has(video.id) || languageCode(video.language) !== language
        || !Number.isFinite(video.difficulty) || video.difficulty < 1 || video.difficulty > 5) return false;
      included.add(video.id);
      return true;
    })
    .map((video, index) => {
      const topicMatches = new Set(video.topics.map(normalize).filter((topic) => interests.has(topic))).size;
      const vocabulary = new Set(video.transcript.flatMap((segment) => segment.words.map((word) =>
        normalize(word.lemma || word.surface).replace(/^[\p{P}\p{S}]+|[\p{P}\p{S}]+$/gu, ''),
      )));
      const weakOverlap = [...vocabulary].filter((word) => weakWords.has(word)).length;
      const exploration = random();
      const score = -Math.abs(video.difficulty - (ability + 0.25))
        + Math.min(topicMatches, 3) * 0.4
        + (watched.has(video.id) ? 0 : 2)
        + Math.min(weakOverlap, 2) * 0.25
        + (Number.isFinite(exploration) ? Math.max(0, Math.min(1, exploration)) : 0.5) * 0.1;
      return { video, score, index };
    })
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map(({ video }) => video);
}
