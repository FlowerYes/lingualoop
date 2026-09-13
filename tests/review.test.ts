import { describe, expect, it } from 'vitest';
import { buildReview } from '../lib/review';
import type { SavedWord } from '../lib/types';

const word = (patch: Partial<SavedWord> = {}): SavedWord => ({
  id: 'casa', surface: 'casa', lemma: 'casa', translation: 'house',
  contextSentence: 'Mi casa es pequeña.', encounters: 1, language: 'es',
  videoId: 'one', savedAt: '2026-09-12T00:00:00.000Z', ...patch,
});

describe('quick review questions', () => {
  it('returns no questions without saved vocabulary', () => {
    expect(buildReview([])).toEqual([]);
  });

  it('creates three useful modes from a single saved word', () => {
    const saved = word();
    const questions = buildReview([saved]);
    expect(questions).toHaveLength(3);
    expect(new Set(questions.map((question) => question.id)).size).toBe(3);
    expect(questions[0]).toMatchObject({ word: saved, answer: 'house' });
    expect(questions[1]).toMatchObject({ word: saved, answer: 'casa', context: '' });
    expect(questions[2]).toMatchObject({ word: saved, answer: 'casa', context: 'Mi ____ es pequeña.' });
    expect(questions[2].prompt).toContain('house');
    expect(new Set(questions.map((question) => question.prompt)).size).toBe(3);
  });

  it('always supplies four distinct choices with exactly one answer', () => {
    const words = [word(), word({ id: 'casa-2', surface: 'Casa', translation: 'House' }), word({ id: 'agua', surface: 'agua', lemma: 'agua', translation: 'water', contextSentence: 'Bebo agua.' })];
    for (const question of buildReview(words)) {
      expect(question.choices).toHaveLength(4);
      expect(new Set(question.choices.map((choice) => choice.toLowerCase())).size).toBe(4);
      expect(question.choices.filter((choice) => choice === question.answer)).toHaveLength(1);
      expect(words).toContain(question.word);
      expect([question.word.surface, question.word.translation]).toContain(question.answer);
    }
  });

  it('uses saved words in deterministic order without mutating them', () => {
    const words = [word(), word({ id: 'sol', surface: 'sol', lemma: 'sol', translation: 'sun', contextSentence: 'Sale el sol.' })];
    const before = structuredClone(words);
    expect(buildReview(words)).toEqual(buildReview(words));
    expect(buildReview(words).map((question) => question.word.id)).toEqual(['casa', 'sol', 'casa']);
    expect(words).toEqual(before);
  });

  it('blanks accented words next to Unicode punctuation without matching longer words', () => {
    const questions = buildReview([word({ surface: '¡sí!', lemma: 'sí', translation: 'yes', contextSentence: '«Sí», sí: síntesis.' })]);
    expect(questions[2].context).toBe('«____», ____: síntesis.');
    expect(questions[2].answer).toBe('¡sí!');
  });

  it('escapes regex characters and does not blank partial words', () => {
    const escaped = buildReview([word({ surface: 'a.b', lemma: 'a.b', contextSentence: 'a.b y axb.' })]);
    expect(escaped[2].context).toBe('____ y axb.');
    const partial = buildReview([word({ surface: 'pan', lemma: 'pan', translation: 'bread', contextSentence: 'La pantalla está encendida.' })]);
    expect(partial[2].answer).toBe('bread');
    expect(partial[2].prompt).toContain('mean');
    expect(partial[2].context).toBe('La pantalla está encendida.');
  });

  it('does not offer a known synonym as an incorrect reverse choice', () => {
    const words = [word({ id: 'hogar', surface: 'hogar', lemma: 'hogar', translation: 'house' }), word()];
    expect(buildReview(words)[1].choices).not.toContain('hogar');
  });
});
