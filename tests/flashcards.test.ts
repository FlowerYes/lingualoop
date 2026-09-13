import { describe, expect, it } from 'vitest';
import { createFlashcardSession, rateFlashcard, revealFlashcard } from '../lib/flashcards';
import type { SavedWord } from '../lib/types';

const word = (id: string): SavedWord => ({
  id,
  surface: id,
  lemma: id,
  translation: `${id} meaning`,
  contextSentence: `Mi ${id}.`,
  encounters: 1,
  language: 'es',
  videoId: 'one',
  savedAt: '2026-09-12T00:00:00.000Z',
});

describe('flashcard study sessions', () => {
  it('handles an empty collection without creating a card', () => {
    const session = createFlashcardSession([]);
    expect(session.cards).toEqual([]);
    expect(session.queue).toEqual([]);
    expect(revealFlashcard(session, session.attempt)).toBe(session);
    expect(rateFlashcard(session, 'known', session.attempt)).toBe(session);
  });

  it('requires revealing a card before rating it', () => {
    const session = createFlashcardSession([word('casa')]);
    expect(rateFlashcard(session, 'known', session.attempt)).toBe(session);
    const revealed = revealFlashcard(session, session.attempt);
    expect(revealed.revealed).toBe(true);
    const complete = rateFlashcard(revealed, 'known', revealed.attempt);
    expect(complete.queue).toEqual([]);
    expect(complete.revealed).toBe(false);
  });

  it('returns a missed card after the remaining cards without growing the queue', () => {
    const session = createFlashcardSession([word('casa'), word('agua'), word('sol')]);
    const next = rateFlashcard(revealFlashcard(session, 0), 'again', 0);
    expect(next.queue).toEqual([1, 2, 0]);
    expect(next.cards).toHaveLength(3);
    expect(next.revealed).toBe(false);
    expect(session.queue).toEqual([0, 1, 2]);
  });

  it('keeps one-word practice bounded through repeated misses and completes when known', () => {
    let session = createFlashcardSession([word('casa')]);
    for (let attempt = 0; attempt < 100; attempt++) {
      session = rateFlashcard(revealFlashcard(session, attempt), 'again', attempt);
      expect(session.queue).toEqual([0]);
    }
    session = rateFlashcard(revealFlashcard(session, 100), 'known', 100);
    expect(session.queue).toEqual([]);
    expect(session.cards).toHaveLength(1);
  });

  it('ignores repeated actions from an earlier attempt', () => {
    const session = createFlashcardSession([word('casa'), word('agua')]);
    const next = rateFlashcard(revealFlashcard(session, 0), 'again', 0);
    expect(rateFlashcard(next, 'again', 0)).toBe(next);
    expect(revealFlashcard(next, 0)).toBe(next);
    const revealedNext = revealFlashcard(next, 1);
    expect(rateFlashcard(revealedNext, 'known', 0)).toBe(revealedNext);
  });

  it('includes each saved word once and restarts the full deck after completion', () => {
    const words = [word('casa'), word('agua'), word('casa')];
    const before = structuredClone(words);
    let session = createFlashcardSession(words);
    expect(session.cards.map((card) => card.id)).toEqual(['casa', 'agua']);
    session = rateFlashcard(revealFlashcard(session, 0), 'known', 0);
    session = rateFlashcard(revealFlashcard(session, 1), 'known', 1);
    expect(session.queue).toEqual([]);
    const restarted = createFlashcardSession(session.cards);
    expect(restarted.queue).toEqual([0, 1]);
    expect(restarted.revealed).toBe(false);
    expect(restarted.attempt).toBe(0);
    expect(words).toEqual(before);
  });
});
