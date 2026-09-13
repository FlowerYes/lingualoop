import type { SavedWord } from './types';

export interface FlashcardSession {
  cards: SavedWord[];
  queue: number[];
  attempt: number;
  revealed: boolean;
}

export function createFlashcardSession(words: SavedWord[]): FlashcardSession {
  const seen = new Set<string>();
  const cards = words.filter((word) => {
    if (seen.has(word.id)) return false;
    seen.add(word.id);
    return true;
  });
  return { cards, queue: cards.map((_, index) => index), attempt: 0, revealed: false };
}

export function revealFlashcard(session: FlashcardSession, attempt: number): FlashcardSession {
  if (session.queue.length === 0 || session.revealed || session.attempt !== attempt) return session;
  return { ...session, revealed: true };
}

export function rateFlashcard(
  session: FlashcardSession,
  rating: 'again' | 'known',
  attempt: number,
): FlashcardSession {
  // A delayed second click must never rate the next card or append a duplicate.
  if (!session.revealed || session.queue.length === 0 || session.attempt !== attempt)
    return session;
  const [current, ...remaining] = session.queue;
  return {
    ...session,
    queue: rating === 'again' ? [...remaining, current] : remaining,
    attempt: session.attempt + 1,
    revealed: false,
  };
}
