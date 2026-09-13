'use client';
import type { CaptionSegment, CaptionWord } from '@/lib/types';

export function CaptionOverlay({
  caption,
  currentTime,
  assisted,
  onWord,
}: {
  caption: CaptionSegment | undefined;
  currentTime?: number;
  assisted: boolean;
  onWord: (word: CaptionWord, caption: CaptionSegment) => void;
}) {
  if (!caption) return null;

  return (
    <div className="caption-area">
      <div className="caption-lines">
        <p className="spanish-caption" lang="es">
          {caption.words.map((word, index) => {
            const spoken =
              currentTime !== undefined &&
              word.start !== undefined &&
              word.end !== undefined &&
              Number.isFinite(word.start) &&
              Number.isFinite(word.end) &&
              word.start <= currentTime &&
              currentTime < word.end;
            return (
              <button
                type="button"
                key={`${caption.start}-${index}`}
                onClick={() => onWord(word, caption)}
                className={spoken ? 'caption-word is-spoken' : 'caption-word'}
                aria-label={`Explain ${word.surface.replace(/[.,!?¡¿]/g, '')}`}
              >
                <span>{word.surface}</span>
              </button>
            );
          })}
        </p>
        {assisted && <p className="english-caption">{caption.translation}</p>}
      </div>
    </div>
  );
}
