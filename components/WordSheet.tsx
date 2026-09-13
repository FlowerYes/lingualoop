'use client';
import { useEffect, useState } from 'react';
import { BookmarkPlus, Check, Volume2, ArrowUpRight } from 'lucide-react';
import { lookupVocabulary } from '@/data/vocabulary';
import { cacheExplanation, getCachedExplanation, getExplanationKey } from '@/lib/storage';
import type { CaptionSegment, CaptionWord, VideoItem, WordExplanation } from '@/lib/types';
import { Sheet } from './Sheet';
import { useLearner } from './LearnerProvider';

const inflight = new Map<string, Promise<WordExplanation>>();
export function WordSheet({
  word,
  caption,
  video,
  onClose,
}: {
  word: CaptionWord;
  caption: CaptionSegment;
  video: VideoItem;
  onClose: () => void;
}) {
  const { learner, saveWord } = useLearner();
  const surface = word.surface.replace(/^[¡¿“"(]+|[.,!?;:”)]+$/g, '');
  const key = getExplanationKey('es', surface, caption.text);
  const [result, setResult] = useState<WordExplanation | null>(
    () => lookupVocabulary(surface, caption.text) || getCachedExplanation(key),
  );
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [pronunciationError, setPronunciationError] = useState('');
  const saved = !!learner?.savedWords.some(
    (w) => w.lemma.toLocaleLowerCase('es') === (result?.lemma || surface).toLocaleLowerCase('es'),
  );
  useEffect(() => {
    if (result) return;
    let cancelled = false;
    const existing = inflight.get(key);
    const request =
      existing ||
      fetch('/api/explain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          language: 'es',
          word: surface,
          sentence: caption.text,
          translation: caption.translation,
        }),
        signal: AbortSignal.timeout(12000),
      }).then(async (response) => {
        if (!response.ok) throw new Error('Explanation unavailable');
        const data: WordExplanation = await response.json();
        if (!data.lemma || !data.translation) throw new Error('Invalid explanation');
        cacheExplanation(key, data);
        return data;
      });
    if (!existing) {
      inflight.set(key, request);
      request.finally(() => inflight.delete(key)).catch(() => {});
    }
    request
      .then((value) => {
        if (!cancelled) setResult(value);
      })
      .catch(() => {
        if (!cancelled) setError('This explanation couldn’t load. Try again in a moment.');
      });
    return () => {
      cancelled = true;
    };
  }, [key, surface, caption.text, caption.translation, result, attempt]);
  const speak = () => {
    if (!('speechSynthesis' in window)) {
      setPronunciationError(
        'Pronunciation is not available in this browser. Listen for this word in the video.',
      );
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(surface);
    utterance.lang = 'es-ES';
    utterance.rate = 0.8;
    utterance.onerror = () => setPronunciationError('Listen for this word in the video.');
    window.speechSynthesis.speak(utterance);
  };
  return (
    <Sheet titleId="word-title" onClose={onClose} className="word-sheet">
      <div className="word-title-row">
        <h2 id="word-title" lang="es">
          {surface}
        </h2>
        <button
          className="pronounce-button"
          onClick={speak}
          aria-label={`Hear ${surface} pronounced`}
        >
          <Volume2 size={20} />
        </button>
      </div>
      {pronunciationError && <p className="inline-message">{pronunciationError}</p>}
      {result ? (
        <>
          <p className="word-lemma">
            <span lang="es">{result.lemma}</span>
            <span>Spanish</span>
          </p>
          <p className="word-translation">{result.translation}</p>
          <div className="word-context">
            <span className="context-label">In this moment</span>
            <blockquote lang="es">“{caption.text}”</blockquote>
            <p>{result.contextMeaning}</p>
          </div>
          <p className="word-explanation">{result.explanation}</p>
          <div className="word-example">
            <ArrowUpRight size={18} aria-hidden="true" />
            <div>
              <span className="context-label">Try saying</span>
              <p lang="es">{result.example}</p>
            </div>
          </div>
          <button
            className={saved ? 'button saved-button full-width' : 'button primary full-width'}
            disabled={saved}
            onClick={() =>
              saveWord({
                id: `es-${result.lemma.toLowerCase()}`,
                surface,
                lemma: result.lemma,
                translation: result.translation,
                contextSentence: caption.text,
                encounters: 1,
                language: 'es',
                videoId: video.id,
                savedAt: new Date().toISOString(),
              })
            }
          >
            {saved ? <Check size={19} /> : <BookmarkPlus size={19} />}
            {saved ? 'Saved to your words' : 'Save word'}
          </button>
          <p className="sheet-footnote">A new word. A little more of the world.</p>
        </>
      ) : error ? (
        <div className="sheet-error">
          <p role="alert">{error}</p>
          <button
            className="button secondary"
            onClick={() => {
              setError('');
              setAttempt((value) => value + 1);
            }}
          >
            Try again
          </button>
        </div>
      ) : (
        <div className="word-skeleton" role="status">
          <div />
          <div />
          <div />
          <span className="sr-only">Finding a definition in this context</span>
        </div>
      )}
    </Sheet>
  );
}
