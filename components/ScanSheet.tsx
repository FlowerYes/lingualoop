'use client';

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, RefreshCw, ScanText } from 'lucide-react';
import type { CaptionSegment, CaptionWord, VideoItem } from '@/lib/types';
import { scanFrame, type ScanProgress, type ScanResult } from '@/lib/scan';
import { Sheet } from './Sheet';
import styles from './ScanSheet.module.css';

type ScanState =
  | { state: 'loading'; progress: ScanProgress }
  | { state: 'complete'; result: ScanResult }
  | { state: 'error'; message: string };

export function ScanSheet({
  image,
  video,
  onClose,
  onWord,
}: {
  image: string | null;
  video: VideoItem;
  onClose: () => void;
  onWord?: (word: CaptionWord, caption: CaptionSegment, video: VideoItem) => void;
}) {
  const [attempt, setAttempt] = useState(0);
  const [scan, setScan] = useState<ScanState>({
    state: 'loading',
    progress: { status: 'loading', progress: 0 },
  });
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState('');
  const [dimensions, setDimensions] = useState({ width: 1, height: 1 });
  const controller = useRef<AbortController | null>(null);

  useEffect(() => {
    if (!image) return;
    const abort = new AbortController();
    controller.current = abort;
    scanFrame(image, abort.signal, (progress) => {
      if (!abort.signal.aborted) setScan({ state: 'loading', progress });
    })
      .then((result) => {
        if (!abort.signal.aborted) setScan({ state: 'complete', result });
      })
      .catch((error: unknown) => {
        if (!abort.signal.aborted)
          setScan({
            state: 'error',
            message: error instanceof Error ? error.message : 'Scanning failed. Please try again.',
          });
      });
    return () => abort.abort();
  }, [image, attempt]);

  const close = () => {
    controller.current?.abort();
    onClose();
  };
  const retry = () => {
    setScan({ state: 'loading', progress: { status: 'loading', progress: 0 } });
    setCopied(false);
    setCopyError('');
    setAttempt((value) => value + 1);
  };
  const result = scan.state === 'complete' ? scan.result : null;
  const selectWord = (surface: string) => {
    if (!result || !onWord) return;
    if (window.getSelection()?.toString()) return;
    onWord(
      { surface },
      {
        start: 0,
        end: 0,
        text: result.text,
        translation: '',
        words: result.words.map((word) => ({ surface: word.text })),
      },
      video,
    );
  };
  const recognizing = scan.state === 'loading' && scan.progress.status === 'recognizing text';
  const progress =
    scan.state === 'loading'
      ? Math.round(Math.min(1, Math.max(0, scan.progress.progress)) * 100)
      : 100;

  return (
    <Sheet titleId="scan-title" onClose={close} className={styles.panel}>
      <div className={styles.heading}>
        <ScanText size={24} aria-hidden="true" />
        <h2 id="scan-title">Scan text</h2>
      </div>
      <p className={styles.description}>Read the words in this video frame.</p>
      {image ? (
        <div className={styles.preview}>
          {/* A captured canvas data URL cannot use Next image optimization. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image}
            alt={`Captured frame from ${video.title}`}
            onLoad={(event) =>
              setDimensions({
                width: event.currentTarget.naturalWidth,
                height: event.currentTarget.naturalHeight,
              })
            }
          />
          {result?.words.map((word, index) => (
            <span
              className={styles.box}
              key={index}
              aria-hidden="true"
              style={{
                left: `${(word.bbox.x0 / dimensions.width) * 100}%`,
                top: `${(word.bbox.y0 / dimensions.height) * 100}%`,
                width: `${((word.bbox.x1 - word.bbox.x0) / dimensions.width) * 100}%`,
                height: `${((word.bbox.y1 - word.bbox.y0) / dimensions.height) * 100}%`,
              }}
            />
          ))}
        </div>
      ) : (
        <div className={styles.empty}>
          <ScanText size={32} />
          <h3>No frame to scan</h3>
          <p>Return to the video, let it load, then tap Scan again.</p>
          <button className={styles.button} onClick={close}>
            Back to video
          </button>
        </div>
      )}
      {image && scan.state === 'loading' && (
        <div className={styles.status} role="status">
          <span>{recognizing ? 'Reading this frame…' : 'Preparing text scanner…'}</span>
          <span>{recognizing ? `${progress}%` : ''}</span>
          <progress
            max={100}
            value={recognizing ? progress : undefined}
            aria-label={recognizing ? 'Reading text' : 'Loading scanner'}
          />
        </div>
      )}
      {image && scan.state === 'error' && (
        <div className={styles.empty} role="alert">
          <h3>Couldn’t scan this frame</h3>
          <p>{scan.message}</p>
          <button className={styles.button} onClick={retry}>
            <RefreshCw size={16} />
            Try again
          </button>
        </div>
      )}
      {result && (
        <section className={styles.result} aria-label="Scanned text">
          <div className={styles.resultHeading}>
            <h3>{result.text ? 'Text found' : 'No clear text found'}</h3>
            {result.text && (
              <button
                className={styles.copy}
                onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(result.text);
                    setCopied(true);
                    setCopyError('');
                  } catch {
                    setCopyError('Select and hold the text below to copy it.');
                  }
                }}
                aria-label={copied ? 'Text copied' : 'Copy scanned text'}
              >
                {copied ? <Check size={17} /> : <Copy size={17} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            )}
          </div>
          {result.text ? (
            <>
              <p className={styles.hint}>
                {onWord
                  ? 'Tap a word for its meaning, or select text to copy.'
                  : 'Select or copy the text below.'}
              </p>
              <p className={styles.text} lang={video.language}>
                {result.text.split(/(\s+)/u).map((part, index) =>
                  /\s/u.test(part) || !onWord ? (
                    part
                  ) : (
                    <button className={styles.word} key={index} onClick={() => selectWord(part)}>
                      {part}
                    </button>
                  ),
                )}
              </p>
            </>
          ) : (
            <p className={styles.hint}>
              Try a frame with larger, sharper text. Pause the video before scanning.
            </p>
          )}
          {copyError && (
            <p className={styles.hint} role="status">
              {copyError}
            </p>
          )}
        </section>
      )}
      {image && <p className={styles.privacy}>Processed on your device. The frame stays here.</p>}
    </Sheet>
  );
}
