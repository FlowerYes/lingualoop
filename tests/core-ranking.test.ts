import { describe, expect, it } from 'vitest';
import { createLearner } from '../lib/learner';
import { rankVideos } from '../lib/ranking';
import type { VideoItem } from '../lib/types';

const video = (id: string, patch: Partial<VideoItem> = {}): VideoItem => ({
  id, language: 'es', difficulty: 2, topics: [], src: '/demo.mp4', poster: '/poster.jpg',
  creator: 'Ana', handle: '@ana', title: id, location: 'Madrid', duration: 15, transcript: [], ...patch,
});
const options = { random: () => 0.5 };

describe('video recommendations', () => {
  it('prefers difficulty slightly above ability', () => {
    const learner = createLearner('es', 1.5, []);
    expect(rankVideos([video('easier', { difficulty: 1 }), video('harder', { difficulty: 2 }), video('too-hard', { difficulty: 4 })], learner, options).map((item) => item.id)).toEqual(['harder', 'easier', 'too-hard']);
  });

  it('uses interests, then weak saved vocabulary overlap, for otherwise similar videos', () => {
    const learner = createLearner('es', 2, ['food']);
    learner.savedWords = [{ id: 'casa', surface: 'casa', lemma: 'casa', translation: 'house', contextSentence: 'Mi casa.', encounters: 1, language: 'es', videoId: 'old', savedAt: '2026-09-12' }];
    const vocabularyVideo = video('vocabulary', { transcript: [{ start: 0, end: 3, text: 'Mi casa.', translation: 'My house.', words: [{ surface: 'casa', lemma: 'casa' }] }] });
    expect(rankVideos([video('plain'), vocabularyVideo, video('interest', { topics: ['food'] })], learner, options).map((item) => item.id)).toEqual(['interest', 'vocabulary', 'plain']);
  });

  it('prioritizes unseen content, excludes immediate repeats, and filters other languages', () => {
    const learner = createLearner('Spanish', 2, []);
    learner.watchedVideoIds = ['seen'];
    const result = rankVideos([video('seen'), video('unseen'), video('excluded'), video('french', { language: 'fr' })], learner, { ...options, excludeIds: ['excluded'] });
    expect(result.map((item) => item.id)).toEqual(['unseen', 'seen']);
  });

  it('keeps source data immutable, removes duplicate ids, and has deterministic exploration', () => {
    const source = [video('a'), video('b'), video('a')];
    const values = [0, 1];
    const result = rankVideos(source, createLearner('es', 2, []), { random: () => values.shift() ?? 0 });
    expect(result.map((item) => item.id)).toEqual(['b', 'a']);
    expect(source.map((item) => item.id)).toEqual(['a', 'b', 'a']);
  });
});
