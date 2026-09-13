'use client';

import { useState } from 'react';
import { Languages, Play, Share2 } from 'lucide-react';
import type { CaptionSegment, CaptionWord, VideoItem } from '@/lib/types';
import { Sheet } from './Sheet';
import styles from './ImmersionPanels.module.css';

export function TranscriptSheet({
  video,
  time,
  assisted,
  onAssisted,
  onWord,
  onReplay,
  onClose,
}: {
  video: VideoItem;
  time: number;
  assisted: boolean;
  onAssisted: () => void;
  onWord: (word: CaptionWord, caption: CaptionSegment, video: VideoItem) => void;
  onReplay: (time: number) => void;
  onClose: () => void;
}) {
  const [shareMessage, setShareMessage] = useState('');
  const [shareUrl, setShareUrl] = useState('');
  const share = async () => {
    const url = new URL('/feed', window.location.origin);
    url.searchParams.set('clip', video.id);
    try {
      if (navigator.share) {
        await navigator.share({
          title: video.title,
          text: 'A little Spanish with LinguaLoop',
          url: url.href,
        });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url.href);
        setShareMessage('Video link copied.');
      } else {
        setShareUrl(url.href);
      }
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setShareUrl(url.href);
    }
  };
  return (
    <Sheet
      titleId="transcript-title"
      onClose={onClose}
      className={`transcript-sheet ${styles.panel} ${styles.fromLeft}`}
      dismissDirection="left"
    >
      <h2 id="transcript-title">Comments</h2>
      <p className="sheet-description">
        Tap a word for its meaning. Replay any sentence to hear it again.
      </p>
      <div className="transcript-toolbar">
        <span>{video.title}</span>
        <button className="transcript-translation" aria-pressed={assisted} onClick={onAssisted}>
          <Languages size={17} aria-hidden="true" /> English
        </button>
        <button className="transcript-share icon-button" aria-label="Share video" onClick={share}>
          <Share2 size={19} aria-hidden="true" />
        </button>
      </div>
      {shareMessage && (
        <p className="inline-message" role="status">
          {shareMessage}
        </p>
      )}
      {shareUrl && (
        <label className="share-link-field">
          Copy this video link
          <input value={shareUrl} readOnly onFocus={(event) => event.currentTarget.select()} />
        </label>
      )}
      <h3>Transcript</h3>
      <ol className="transcript-segments">
        {video.transcript.map((segment) => (
          <li
            key={segment.start}
            className={segment.start <= time && time < segment.end ? 'current' : ''}
          >
            <button
              className="sentence-replay"
              onClick={() => onReplay(segment.start)}
              aria-label={`Replay sentence at ${Math.floor(segment.start)} seconds`}
            >
              <Play size={15} aria-hidden="true" />
              <span>
                {Math.floor(segment.start / 60)}:
                {Math.floor(segment.start % 60)
                  .toString()
                  .padStart(2, '0')}
              </span>
            </button>
            <div>
              <p className="transcript-spanish" lang="es">
                {segment.words.map((word, index) => (
                  <button
                    key={`${word.surface}-${index}`}
                    className="transcript-word"
                    onClick={() => onWord(word, segment, video)}
                  >
                    {word.surface}
                  </button>
                ))}
              </p>
              {assisted && <p className="transcript-english">{segment.translation}</p>}
            </div>
          </li>
        ))}
      </ol>
      {video.sourceUrl && (
        <>
          <a className={styles.source} href={video.sourceUrl} target="_blank" rel="noreferrer">
            View @{video.handle} on TikTok
          </a>
          <p className={styles.sourceNote}>See the original video and its comments on TikTok.</p>
        </>
      )}
    </Sheet>
  );
}
