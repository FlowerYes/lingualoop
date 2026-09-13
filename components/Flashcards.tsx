'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Check, Play, RotateCcw, Volume2 } from 'lucide-react';
import { createFlashcardSession, rateFlashcard, revealFlashcard } from '@/lib/flashcards';
import type { SavedWord } from '@/lib/types';
import { Sheet } from './Sheet';
import styles from './ImmersionPanels.module.css';

export function Flashcards({
  words,
  onClose,
  immersive = false,
  onWatchContext,
}: {
  words: SavedWord[];
  onClose: () => void;
  immersive?: boolean;
  onWatchContext?: (word: SavedWord) => void;
}) {
  const [session, setSession] = useState(() => createFlashcardSession(words));
  const [pronunciationError, setPronunciationError] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const answer = useRef<HTMLDivElement>(null);
  const utterance = useRef<SpeechSynthesisUtterance | null>(null);
  const word = session.cards[session.queue[0]];
  const total = session.cards.length;
  const remembered = total - session.queue.length;
  const finished = total > 0 && session.queue.length === 0;

  useEffect(() => {
    heading.current?.focus();
  }, [session.attempt]);

  useEffect(() => {
    if (session.revealed) answer.current?.focus();
  }, [session.revealed]);

  useEffect(() => {
    return () => {
      if (utterance.current && 'speechSynthesis' in window) {
        utterance.current.onerror = null;
        window.speechSynthesis.cancel();
        utterance.current = null;
      }
    };
  }, [session.attempt]);

  const speak = () => {
    if (!word) return;
    if (!('speechSynthesis' in window)) {
      setPronunciationError('Pronunciation is not available in this browser.');
      return;
    }
    setPronunciationError('');
    if (utterance.current) utterance.current.onerror = null;
    window.speechSynthesis.cancel();
    const speech = new SpeechSynthesisUtterance(word.surface);
    speech.lang = 'es-ES';
    speech.rate = 0.8;
    speech.onerror = () => setPronunciationError('This word couldn’t play. Try listening again.');
    utterance.current = speech;
    window.speechSynthesis.speak(speech);
  };

  const rate = (rating: 'again' | 'known') => {
    setPronunciationError('');
    setSession((current) => rateFlashcard(current, rating, session.attempt));
  };

  return (
    <Sheet
      titleId="flashcards-title"
      onClose={onClose}
      className={`review-sheet flashcards-sheet ${immersive ? `${styles.panel} ${styles.fromLeft}` : ''}`}
      dismissDirection={immersive ? 'left' : undefined}
    >
      {total === 0 ? (
        <div className="review-complete">
          <h2 id="flashcards-title" ref={heading} tabIndex={-1}>
            Save a word first.
          </h2>
          <p>Tap a subtitle in the feed and save it to start practicing.</p>
          <button className="button primary full-width" onClick={onClose}>
            {immersive ? 'Back to video' : 'Back to your words'}
          </button>
        </div>
      ) : finished ? (
        <div className="review-complete">
          <span className="complete-symbol" aria-hidden="true">
            <Check size={32} />
          </span>
          <h2 id="flashcards-title" ref={heading} tabIndex={-1}>
            A little more familiar.
          </h2>
          <p>
            You remembered {total === 1 ? 'your word' : `all ${total} words`} in this session.
            <br />
            Come back whenever you want another go.
          </p>
          <div className="flashcard-actions">
            <button
              className="button secondary full-width"
              onClick={() => {
                setPronunciationError('');
                setSession(createFlashcardSession(session.cards));
              }}
            >
              <RotateCcw size={17} aria-hidden="true" />
              Practice again
            </button>
            <button className="button primary full-width" onClick={onClose}>
              {immersive ? 'Back to video' : 'Back to your words'}
              <ArrowRight size={17} aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : (
        <>
          <h2 id="flashcards-title">Flashcards</h2>
          <div className="flashcard-progress">
            <p role="status" aria-live="polite">
              {remembered} of {total} remembered
            </p>
            <progress value={remembered} max={total} aria-label="Words remembered this session" />
          </div>
          <div className="word-title-row">
            <h3 className="flashcard-word" ref={heading} tabIndex={-1} lang="es">
              {word.surface}
            </h3>
            <button
              className="pronounce-button"
              onClick={speak}
              aria-label={`Hear ${word.surface} pronounced`}
            >
              <Volume2 size={20} aria-hidden="true" />
            </button>
          </div>
          {pronunciationError && (
            <p className="inline-message" role="status">
              {pronunciationError}
            </p>
          )}
          {session.revealed ? (
            <>
              <div
                className="flashcard-answer"
                id="flashcard-answer"
                ref={answer}
                role="region"
                aria-label={`Meaning of ${word.surface}`}
                tabIndex={-1}
              >
                <p className="word-translation">{word.translation}</p>
                <p className="flashcard-context" lang="es">
                  “{word.contextSentence}”
                </p>
              </div>
              <div className="flashcard-actions">
                <button className="button secondary" onClick={() => rate('again')}>
                  <RotateCcw size={17} aria-hidden="true" />
                  Study again
                </button>
                <button className="button primary" onClick={() => rate('known')}>
                  <Check size={17} aria-hidden="true" />
                  Got it
                </button>
              </div>
              {onWatchContext && (
                <button
                  className={`button secondary full-width ${styles.contextReplay}`}
                  onClick={() => onWatchContext(word)}
                >
                  <Play size={16} /> Watch in context
                </button>
              )}
            </>
          ) : (
            <>
              <p className="flashcard-prompt">What does this word mean?</p>
              <button
                className="button primary full-width"
                onClick={() => setSession((current) => revealFlashcard(current, session.attempt))}
              >
                Reveal meaning
                <ArrowRight size={17} aria-hidden="true" />
              </button>
            </>
          )}
          <p className="flashcard-session-note">
            Study again brings the word back. Practice at your own pace.
          </p>
        </>
      )}
    </Sheet>
  );
}
