import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { videos } from '../data/videos';

describe('real Spanish TikTok catalog', () => {
  it('ships three independent attributed TikTok videos with local media', () => {
    expect(videos).toHaveLength(3);
    expect(new Set(videos.map((video) => video.sourceUrl)).size).toBe(3);
    for (const video of videos) {
      expect(video.sourcePlatform).toBe('tiktok');
      expect(video.sourceUrl).toMatch(/^https:\/\/www\.tiktok\.com\/@[\w.]+\/video\/\d+$/);
      expect(video.language).toBe('es');
      expect(existsSync(resolve('public', video.src.slice(1)))).toBe(true);
      expect(existsSync(resolve('public', video.poster.slice(1)))).toBe(true);
    }
  });

  it('keeps captions and speech timings inside the actual video', () => {
    for (const video of videos) {
      expect(video.transcript.length).toBeGreaterThan(0);
      let previousEnd = 0;
      for (const caption of video.transcript) {
        expect(caption.start).toBeGreaterThanOrEqual(previousEnd);
        expect(caption.end).toBeGreaterThan(caption.start);
        expect(caption.end).toBeLessThanOrEqual(video.duration + 0.02);
        expect(caption.translation.trim()).not.toBe('');
        expect(caption.words.map((word) => word.surface).join(' ')).toBe(caption.text);
        let wordEnd = caption.start;
        for (const word of caption.words) {
          expect(word.lemma).toBeTruthy();
          expect(word.translation).toBeTruthy();
          if (word.start !== undefined && word.end !== undefined) {
            expect(word.start).toBeGreaterThanOrEqual(wordEnd - 0.001);
            expect(word.end).toBeGreaterThan(word.start);
            expect(word.end).toBeLessThanOrEqual(caption.end + 0.001);
            wordEnd = word.end;
          }
        }
        previousEnd = caption.end;
      }
    }
  });
});
