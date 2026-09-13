'use client';

import { useEffect, useState } from 'react';
import { BookmarkPlus, Check, Volume2, X } from 'lucide-react';
import type { CaptionSegment, CaptionWord, VideoItem } from '@/lib/types';
import { lookupVocabulary } from '@/data/vocabulary';
import { useLearner } from './LearnerProvider';
import styles from './ImmersionPanels.module.css';

/** Caption help deliberately leaves the video and its controls interactive. */
export function WordPopover({
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
  const [message, setMessage] = useState('');
  const surface = word.surface.replace(/^[¡¿“"(]+|[.,!?;:”)]+$/g, '');
  const definition = lookupVocabulary(surface, caption.text);
  const lemma = word.lemma || definition?.lemma || surface.toLocaleLowerCase('es');
  const translation = word.translation || definition?.translation;
  const saved = learner?.savedWords.some(
    (item) => item.lemma.toLocaleLowerCase('es') === lemma.toLocaleLowerCase('es'),
  );
  useEffect(() => {
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', escape);
    return () => window.removeEventListener('keydown', escape);
  }, [onClose]);
  const speak = () => {
    if (!('speechSynthesis' in window)) {
      setMessage('Replay the sentence to hear this word.');
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(surface);
    utterance.lang = 'es-ES';
    utterance.rate = 0.85;
    utterance.onerror = () => setMessage('Replay the sentence to hear this word.');
    window.speechSynthesis.speak(utterance);
  };
  return (
    <section className={styles.wordPopover} aria-label={`Meaning of ${surface}`}>
      <button className={styles.close} onClick={onClose} aria-label="Close definition">
        <X size={19} />
      </button>
      <h3 lang="es">
        {surface}
        {lemma !== surface.toLocaleLowerCase('es') && <span> · {lemma}</span>}
      </h3>
      <p className={styles.meaning}>{translation || caption.translation}</p>
      <p className={styles.explanation}>
        {word.explanation ||
          definition?.explanation ||
          (translation
            ? 'Listen to how it is used in this sentence.'
            : 'Sentence translation. Open the transcript for more context.')}
      </p>
      <div className={styles.wordTools}>
        <button onClick={speak} aria-label={`Hear ${surface}`}>
          <Volume2 size={16} /> Listen
        </button>
        {translation && (
          <button
            disabled={saved}
            onClick={() =>
              saveWord({
                id: `es-${lemma.toLocaleLowerCase('es')}`,
                surface,
                lemma,
                translation,
                contextSentence: caption.text,
                encounters: 1,
                language: 'es',
                videoId: video.id,
                savedAt: new Date().toISOString(),
              })
            }
          >
            {saved ? <Check size={16} /> : <BookmarkPlus size={16} />}
            {saved ? 'Saved' : 'Save word'}
          </button>
        )}
      </div>
      {message && <p role="status">{message}</p>}
    </section>
  );
}
