'use client';
import { useCallback, useEffect, useRef, useState, type PointerEvent } from 'react';
import {
  Heart,
  Volume2,
  VolumeX,
  Pause,
  Play,
  MessageSquare,
  RotateCcw,
  ClosedCaption,
  CircleAlert,
  Send,
  Scan,
  Ellipsis,
  Languages,
  BookOpen,
} from 'lucide-react';
import type { CaptionSegment, CaptionWord, VideoItem, WatchEvent } from '@/lib/types';
import {
  addWatchedRange,
  clampSeek,
  classifyPlaybackGesture,
  playbackCredit,
  watchedCompletion,
  type GesturePoint,
  type WatchedRange,
  type PlaybackEvidence,
} from '@/lib/playback';
import { CaptionOverlay } from './CaptionOverlay';

interface Props {
  video: VideoItem;
  active: boolean;
  near: boolean;
  suspended: boolean;
  muted: boolean;
  savedCount: number;
  liked: boolean;
  assisted: boolean;
  playbackRate: number;
  initialTime?: number;
  initialEvidence?: PlaybackEvidence;
  transcriptAssistance?: { wordTaps: number; translationOpened: boolean };
  seekTo?: { time: number; key: number };
  onMute: () => void;
  onLike: () => void;
  onAssisted: () => void;
  onPosition?: (time: number, evidence: PlaybackEvidence) => void;
  onWord: (word: CaptionWord, caption: CaptionSegment, video: VideoItem) => void;
  onTutor: (video: VideoItem) => void;
  onTranscript: (video: VideoItem, time: number) => void;
  onShare: (video: VideoItem) => void;
  onFlashcards: () => void;
  onScan: (video: VideoItem, image: string | null) => void;
  onDifficulty: () => void;
  onEvent: (event: WatchEvent, seconds: number) => void;
}

const formatTime = (value: number) => {
  const seconds = Math.max(0, Math.floor(value));
  return `${Math.floor(seconds / 60)}:${(seconds % 60).toString().padStart(2, '0')}`;
};

export function VideoCard({
  video,
  active,
  near,
  suspended,
  muted,
  savedCount,
  liked,
  assisted,
  playbackRate,
  initialTime = 0,
  initialEvidence,
  transcriptAssistance,
  seekTo,
  onMute,
  onLike,
  onAssisted,
  onPosition,
  onWord,
  onTutor,
  onTranscript,
  onShare,
  onFlashcards,
  onScan,
  onDifficulty,
  onEvent,
}: Props) {
  const player = useRef<HTMLVideoElement>(null);
  const [time, setTime] = useState(() => clampSeek(initialTime, video.duration));
  const [duration, setDuration] = useState(video.duration);
  const [paused, setPaused] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [captionsVisible, setCaptionsVisible] = useState(true);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const optionsMenu = useRef<HTMLDivElement>(null);
  const optionsToggle = useRef<HTMLButtonElement>(null);
  const resumeTime = useRef(clampSeek(initialTime, video.duration));
  const seeking = useRef(false);
  const consumedSeek = useRef<number | undefined>(undefined);
  const scrubbing = useRef<{ pointerId: number; wasPlaying: boolean } | null>(null);
  const gesture = useRef<(GesturePoint & { pointerId: number; moved: boolean }) | null>(null);
  const pendingTap = useRef<GesturePoint | null>(null);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stats = useRef({
    seconds: 0,
    ranges: initialEvidence?.ranges.map(([start, end]) => [start, end] as WatchedRange) || [],
    lastTime: 0,
    lastWallTime: 0,
    wordTaps: initialEvidence?.wordTaps || 0,
    translationOpened: initialEvidence?.translationOpened || false,
    replayed: initialEvidence?.replayed || false,
    committed: false,
  });
  const eventHandler = useRef(onEvent);
  const positionHandler = useRef(onPosition);
  const transcriptHelp = useRef(transcriptAssistance);
  useEffect(() => {
    eventHandler.current = onEvent;
    positionHandler.current = onPosition;
    transcriptHelp.current = transcriptAssistance;
  }, [onEvent, onPosition, transcriptAssistance]);

  useEffect(() => {
    if (!optionsOpen) return;
    optionsMenu.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const dismiss = (event: globalThis.PointerEvent) => {
      if (
        event.target instanceof Node &&
        !optionsMenu.current?.contains(event.target) &&
        !optionsToggle.current?.contains(event.target)
      )
        setOptionsOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOptionsOpen(false);
      optionsToggle.current?.focus();
    };
    document.addEventListener('pointerdown', dismiss);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('pointerdown', dismiss);
      document.removeEventListener('keydown', escape);
    };
  }, [optionsOpen]);

  const resetSample = useCallback(() => {
    stats.current.lastTime = player.current?.currentTime || 0;
    stats.current.lastWallTime = performance.now();
  }, []);
  const savePosition = useCallback(() => {
    const s = stats.current;
    positionHandler.current?.(resumeTime.current, {
      ranges: s.ranges.map(([start, end]) => [start, end]),
      wordTaps: s.wordTaps + (transcriptHelp.current?.wordTaps || 0),
      translationOpened: s.translationOpened || !!transcriptHelp.current?.translationOpened,
      replayed: s.replayed,
    });
  }, []);
  const flush = useCallback(() => {
    savePosition();
    const s = stats.current;
    if (s.seconds <= 0) return;
    const mediaDuration = player.current?.duration;
    eventHandler.current(
      {
        videoId: video.id,
        completionRatio: watchedCompletion(
          s.ranges,
          mediaDuration && Number.isFinite(mediaDuration) ? mediaDuration : video.duration,
        ),
        wordTaps: s.wordTaps + (transcriptHelp.current?.wordTaps || 0),
        translationOpened: s.translationOpened || !!transcriptHelp.current?.translationOpened,
        replayed: s.replayed,
        savedWords: savedCount,
      },
      s.seconds,
    );
    s.seconds = 0;
  }, [video.id, video.duration, savedCount, savePosition]);
  const flushRef = useRef(flush);
  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const playWhenAllowed = useCallback(() => {
    const element = player.current;
    if (!element || !active || !near || suspended || paused || document.hidden || scrubbing.current)
      return;
    resetSample();
    element.play().catch(() => {
      setPlaying(false);
      setBuffering(false);
    });
  }, [active, near, suspended, paused, resetSample]);

  const clearTap = useCallback(() => {
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = null;
    pendingTap.current = null;
  }, []);

  useEffect(() => {
    const element = player.current;
    if (!element) return;
    if (active && !suspended && !paused && !document.hidden && !failed) playWhenAllowed();
    else {
      element.pause();
      resetSample();
      clearTap();
      gesture.current = null;
      if (!active) flushRef.current();
    }
  }, [active, suspended, paused, near, failed, playWhenAllowed, resetSample, clearTap]);

  useEffect(() => {
    const element = player.current;
    if (!element) return;
    resetSample();
    element.playbackRate = Number.isFinite(playbackRate) && playbackRate > 0 ? playbackRate : 1;
  }, [playbackRate, resetSample]);

  useEffect(() => {
    const visibility = () => {
      if (document.hidden) {
        player.current?.pause();
        clearTap();
        gesture.current = null;
        flushRef.current();
      } else playWhenAllowed();
    };
    const pagehide = () => flushRef.current();
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pagehide', pagehide);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pagehide', pagehide);
    };
  }, [playWhenAllowed, clearTap]);

  useEffect(
    () => () => {
      clearTap();
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
      flushRef.current();
    },
    [clearTap],
  );

  const togglePlayback = useCallback(() => {
    clearTap();
    if (!active || suspended) return;
    const element = player.current;
    if (!element) return;
    if (element.paused) {
      setPaused(false);
      resetSample();
      element.play().catch(() => setPlaying(false));
    } else {
      setPaused(true);
      element.pause();
      savePosition();
    }
  }, [active, suspended, clearTap, resetSample, savePosition]);

  useEffect(() => {
    if (!active || suspended) return;
    const keyHandler = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        event.code === 'Space' &&
        !event.repeat &&
        !target.closest('button, a, input, textarea, select, [contenteditable], [role="dialog"]')
      ) {
        event.preventDefault();
        togglePlayback();
      }
    };
    window.addEventListener('keydown', keyHandler);
    return () => window.removeEventListener('keydown', keyHandler);
  }, [active, suspended, togglePlayback]);

  const seekVideo = useCallback(
    (requestedTime: number, resume = false) => {
      const element = player.current;
      const mediaDuration = element?.duration;
      const target = clampSeek(
        requestedTime,
        mediaDuration && Number.isFinite(mediaDuration) ? mediaDuration : video.duration,
      );
      if (target < resumeTime.current - 0.5) stats.current.replayed = true;
      resumeTime.current = target;
      seeking.current = true;
      if (element && element.readyState >= 1) element.currentTime = target;
      resetSample();
      setTime(target);
      savePosition();
      if (resume) {
        setPaused(false);
        if (element && active && !suspended && !document.hidden)
          element.play().catch(() => setPlaying(false));
      }
    },
    [active, suspended, video.duration, resetSample, savePosition],
  );

  useEffect(() => {
    if (!seekTo || consumedSeek.current === seekTo.key) return;
    consumedSeek.current = seekTo.key;
    seekVideo(seekTo.time, true);
  }, [seekTo, seekVideo]);

  const rewind = () => {
    clearTap();
    if (!active || suspended) return;
    seekVideo((player.current?.currentTime || time) - 5, true);
    setFeedback('Rewound 5 seconds');
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(''), 900);
  };

  const finishGesture = (event: PointerEvent<HTMLButtonElement>) => {
    const start = gesture.current;
    gesture.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    if (!start || start.pointerId !== event.pointerId || !active || suspended) return;
    const end = { x: event.clientX, y: event.clientY, time: performance.now() };
    const kind = classifyPlaybackGesture(start, end);
    if (kind === 'swipe-left' || kind === 'swipe-right') {
      clearTap();
      if (kind === 'swipe-left') onTutor(video);
      else onFlashcards();
      return;
    }
    if (kind !== 'tap' || start.moved) {
      clearTap();
      return;
    }
    const previous = pendingTap.current;
    if (
      previous &&
      end.time - previous.time <= 350 &&
      Math.hypot(end.x - previous.x, end.y - previous.y) <= 40
    ) {
      rewind();
      return;
    }
    clearTap();
    pendingTap.current = end;
    tapTimer.current = setTimeout(togglePlayback, 350);
  };

  const handleTime = () => {
    const element = player.current;
    if (!element || element.readyState < 1) return;
    resumeTime.current = element.currentTime;
    setTime(element.currentTime);
    const s = stats.current;
    const now = performance.now();
    if (active && !suspended && !element.paused && !document.hidden) {
      const credit = playbackCredit(
        s.lastTime,
        element.currentTime,
        (now - s.lastWallTime) / 1000,
        element.playbackRate,
        seeking.current || element.seeking || !!scrubbing.current,
      );
      s.seconds += credit.seconds;
      if (credit.range) {
        s.ranges = addWatchedRange(s.ranges, credit.range, duration);
        if (assisted) s.translationOpened = true;
      }
      if (element.currentTime < s.lastTime - 0.5) s.replayed = true;
      if (!s.committed && watchedCompletion(s.ranges, duration) > 0.96) {
        s.committed = true;
        flush();
      }
    }
    s.lastWallTime = now;
    s.lastTime = element.currentTime;
  };

  const finishScrub = (event: PointerEvent<HTMLInputElement>) => {
    const scrub = scrubbing.current;
    if (!scrub || scrub.pointerId !== event.pointerId) return;
    scrubbing.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId))
      event.currentTarget.releasePointerCapture(event.pointerId);
    resetSample();
    savePosition();
    if (scrub.wasPlaying) playWhenAllowed();
  };

  const caption = video.transcript.find((segment) => segment.start <= time && time < segment.end);
  const selectWord = (word: CaptionWord, segment: CaptionSegment) => {
    stats.current.wordTaps++;
    onWord(word, segment, video);
  };
  const toggleTranslation = () => {
    if (!assisted) stats.current.translationOpened = true;
    onAssisted();
  };
  const scanFrame = () => {
    const element = player.current;
    let image: string | null = null;
    if (element && element.readyState >= 2 && element.videoWidth > 0) {
      try {
        const scale = Math.min(1, 1280 / Math.max(element.videoWidth, element.videoHeight));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(element.videoWidth * scale);
        canvas.height = Math.round(element.videoHeight * scale);
        const context = canvas.getContext('2d');
        if (context) {
          context.drawImage(element, 0, 0, canvas.width, canvas.height);
          image = canvas.toDataURL('image/jpeg', 0.88);
        }
      } catch {
        image = null;
      }
    }
    onScan(video, image);
  };

  return (
    <article
      className="video-card"
      data-video-id={video.id}
      data-active={active}
      aria-label={`${video.title}, Spanish level ${['A1', 'A2', 'B1', 'B2'][video.difficulty - 1]}`}
      aria-hidden={!active}
      inert={!active}
    >
      <video
        ref={player}
        className="video-element"
        src={near ? video.src : undefined}
        poster={video.poster}
        preload={active ? 'auto' : near ? 'metadata' : 'none'}
        loop
        playsInline
        muted={muted}
        onTimeUpdate={handleTime}
        onLoadStart={() => {
          setFailed(false);
          setLoaded(false);
          setBuffering(active);
          resetSample();
        }}
        onEmptied={() => {
          setFailed(false);
          setLoaded(false);
          setPlaying(false);
          setBuffering(false);
          seeking.current = false;
          resetSample();
        }}
        onLoadedMetadata={(event) => {
          const element = event.currentTarget;
          const mediaDuration = Number.isFinite(element.duration)
            ? element.duration
            : video.duration;
          setDuration(mediaDuration);
          element.playbackRate =
            Number.isFinite(playbackRate) && playbackRate > 0 ? playbackRate : 1;
          if (resumeTime.current > 0) {
            seeking.current = true;
            element.currentTime = clampSeek(resumeTime.current, mediaDuration);
          } else seeking.current = false;
          resetSample();
        }}
        onLoadedData={() => setLoaded(true)}
        onCanPlay={() => {
          setLoaded(true);
          setBuffering(false);
          playWhenAllowed();
        }}
        onWaiting={() => {
          if (active && !paused && !suspended) setBuffering(true);
          resetSample();
        }}
        onStalled={() => {
          if (active && !paused && !suspended && (player.current?.readyState || 0) < 3)
            setBuffering(true);
        }}
        onSeeking={() => {
          seeking.current = true;
          resetSample();
        }}
        onSeeked={(event) => {
          seeking.current = false;
          resumeTime.current = event.currentTarget.currentTime;
          setTime(resumeTime.current);
          resetSample();
          savePosition();
        }}
        onError={(event) => {
          if (!near || !event.currentTarget.getAttribute('src')) return;
          setFailed(true);
          setLoaded(false);
          setPlaying(false);
          setBuffering(false);
        }}
        onPlay={(event) => {
          if (!active || suspended || document.hidden || paused || scrubbing.current) {
            event.currentTarget.pause();
            return;
          }
          resetSample();
        }}
        onPlaying={(event) => {
          if (!active || suspended || document.hidden || paused || scrubbing.current) {
            event.currentTarget.pause();
            return;
          }
          setPlaying(true);
          setBuffering(false);
          resetSample();
        }}
        onPause={() => {
          setPlaying(false);
          setBuffering(false);
          resetSample();
          savePosition();
        }}
        aria-label={video.title}
      />
      <div className="video-shade" />
      <button
        type="button"
        className="playback-hit-area"
        onClick={(event) => {
          if (event.detail === 0) togglePlayback();
        }}
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0 || !active || suspended) return;
          if (tapTimer.current) clearTimeout(tapTimer.current);
          tapTimer.current = null;
          gesture.current = {
            x: event.clientX,
            y: event.clientY,
            time: performance.now(),
            pointerId: event.pointerId,
            moved: false,
          };
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerMove={(event) => {
          const start = gesture.current;
          if (!start || start.pointerId !== event.pointerId) return;
          if (Math.hypot(event.clientX - start.x, event.clientY - start.y) > 10) {
            start.moved = true;
            clearTap();
          }
        }}
        onPointerUp={finishGesture}
        onPointerCancel={() => {
          gesture.current = null;
          clearTap();
        }}
        onLostPointerCapture={() => {
          gesture.current = null;
        }}
        aria-label={playing ? 'Pause video' : 'Play video'}
        tabIndex={-1}
      />
      <div className="video-top">
        {video.sourceUrl ? (
          <a className="video-source" href={video.sourceUrl} target="_blank" rel="noreferrer">
            {video.handle}
            <span className="sr-only"> · Open original video</span>
          </a>
        ) : (
          <span className="video-source">{video.handle}</span>
        )}
        <button
          className="video-control mute-control"
          onClick={onMute}
          aria-label={muted ? 'Unmute video' : 'Mute video'}
        >
          {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
        </button>
      </div>
      {active && !loaded && !failed && (
        <div className="video-loading" role="status">
          <span>Loading your next moment</span>
          <div className="loading-line" />
        </div>
      )}
      {active && loaded && buffering && !failed && (
        <div className="video-buffering" role="status">
          Buffering video…
        </div>
      )}
      {feedback && (
        <div className="playback-feedback" role="status">
          {feedback}
        </div>
      )}
      {failed ? (
        <div className="video-error" role="status">
          <p>This moment couldn’t load.</p>
          <button
            className="button light"
            onClick={() => {
              setFailed(false);
              setLoaded(false);
              setBuffering(true);
              setPaused(false);
              resetSample();
              player.current?.load();
            }}
          >
            Try again
          </button>
        </div>
      ) : (
        !playing &&
        loaded &&
        !buffering &&
        !suspended && (
          <button className="center-play" onClick={togglePlayback} aria-label="Play video">
            <Play size={28} fill="currentColor" />
          </button>
        )
      )}
      <div className="video-actions">
        <button
          className="video-action"
          aria-label="Scan text in this video frame"
          onClick={scanFrame}
        >
          <span className="video-control">
            <Scan size={31} strokeWidth={3.5} />
          </span>
        </button>
        <button
          className={liked ? 'video-action is-liked' : 'video-action'}
          aria-pressed={liked}
          aria-label={liked ? 'Unlike video' : 'Like video'}
          onClick={onLike}
        >
          <span className="video-control">
            <Heart size={30} fill="currentColor" strokeWidth={1.7} />
          </span>
        </button>
        <button
          className="video-action"
          aria-label="Open transcript"
          onClick={() => onTranscript(video, resumeTime.current)}
        >
          <span className="video-control">
            <MessageSquare size={30} fill="currentColor" strokeWidth={1.8} />
          </span>
        </button>
        <button className="video-action" aria-label="Share video" onClick={() => onShare(video)}>
          <span className="video-control">
            <Send size={30} fill="currentColor" strokeWidth={1.8} />
          </span>
        </button>
        <button
          ref={optionsToggle}
          className="video-action"
          aria-label="Video options"
          aria-expanded={optionsOpen && active}
          aria-controls={`video-options-${video.id}`}
          onClick={() => setOptionsOpen((open) => !open)}
        >
          <span className="video-control">
            <Ellipsis size={31} strokeWidth={3.5} />
          </span>
        </button>
      </div>
      {optionsOpen && active && (
        <div
          className="video-options"
          id={`video-options-${video.id}`}
          ref={optionsMenu}
          role="region"
          aria-label="Video options"
          onBlur={(event) => {
            if (
              event.relatedTarget instanceof Node &&
              !event.currentTarget.contains(event.relatedTarget) &&
              event.relatedTarget !== optionsToggle.current
            )
              setOptionsOpen(false);
          }}
        >
          <button
            aria-pressed={captionsVisible}
            onClick={() => setCaptionsVisible((visible) => !visible)}
          >
            <ClosedCaption size={19} />
            Captions
            <span>{captionsVisible ? 'On' : 'Off'}</span>
          </button>
          <button aria-pressed={assisted} onClick={toggleTranslation}>
            <Languages size={19} />
            English translation
            <span>{assisted ? 'On' : 'Off'}</span>
          </button>
          <button
            onClick={() => {
              setOptionsOpen(false);
              onDifficulty();
            }}
          >
            <CircleAlert size={19} />
            Too hard
          </button>
          <button
            onClick={() => {
              setOptionsOpen(false);
              rewind();
            }}
          >
            <RotateCcw size={19} />
            Replay 5 seconds
          </button>
          <button
            onClick={() => {
              setOptionsOpen(false);
              onTutor(video);
            }}
          >
            <MessageSquare size={19} />
            Ask AI tutor
          </button>
          <button
            onClick={() => {
              setOptionsOpen(false);
              onFlashcards();
            }}
          >
            <BookOpen size={19} />
            Flashcards
          </button>
        </div>
      )}
      <div className="video-bottom">
        <h2 className="sr-only">{video.title}</h2>
        {captionsVisible && (
          <CaptionOverlay
            caption={caption}
            currentTime={time}
            assisted={assisted}
            onWord={selectWord}
          />
        )}
      </div>
      <div className="player-bottom-controls">
        <button
          className="tiny-control"
          aria-label={playing ? 'Pause playback' : 'Resume playback'}
          onClick={togglePlayback}
        >
          {playing ? (
            <Pause size={15} fill="currentColor" />
          ) : (
            <Play size={15} fill="currentColor" />
          )}
        </button>
        <input
          className="playback-seek"
          type="range"
          aria-label="Seek video"
          aria-valuetext={`${formatTime(time)} of ${formatTime(duration)}`}
          min={0}
          max={duration}
          step={0.1}
          value={clampSeek(time, duration)}
          disabled={!loaded || failed}
          onChange={(event) => seekVideo(Number(event.currentTarget.value))}
          onPointerDown={(event) => {
            if (!event.isPrimary || event.button !== 0) return;
            clearTap();
            scrubbing.current = {
              pointerId: event.pointerId,
              wasPlaying: !!player.current && !player.current.paused && !paused,
            };
            event.currentTarget.setPointerCapture(event.pointerId);
            player.current?.pause();
          }}
          onPointerUp={finishScrub}
          onPointerCancel={finishScrub}
          onLostPointerCapture={finishScrub}
        />
        <span className="video-time sr-only" aria-hidden="true">
          {formatTime(time)} / {formatTime(duration)}
        </span>
        <button className="tiny-control" aria-label="Rewind 5 seconds" onClick={rewind}>
          <RotateCcw size={17} />
        </button>
      </div>
    </article>
  );
}
