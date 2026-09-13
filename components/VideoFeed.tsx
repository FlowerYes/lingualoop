'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  ArrowDown,
  ArrowUp,
  ArrowUpRight,
  BookOpen,
  Check,
  Headphones,
  Sparkles,
} from 'lucide-react';
import { videos } from '@/data/videos';
import { rankVideos } from '@/lib/ranking';
import { lookupVocabulary } from '@/data/vocabulary';
import type { CaptionSegment, CaptionWord, LearnerState, VideoItem } from '@/lib/types';
import { useLearner } from './LearnerProvider';
import { VideoCard } from './VideoCard';
import { WordSheet } from './WordSheet';
import { TutorSheet } from './TutorSheet';
import { ProgressBar } from './ProgressBar';
import { TranscriptSheet } from './TranscriptSheet';
import { WordPopover } from './WordPopover';
import { Sheet } from './Sheet';
import { Flashcards } from './Flashcards';
import { BottomNav } from './BottomNav';
import { ScanSheet } from './ScanSheet';

type Selection = { word: CaptionWord; caption: CaptionSegment; video: VideoItem; inline?: boolean };
export function VideoFeed({ learner }: { learner: LearnerState }) {
  const {
    recordWatch,
    saveWord,
    preferences,
    updatePreferences,
    toggleLike,
    adjustDifficulty,
    notify,
    feedSession,
    updateFeedSession,
  } = useLearner();
  const [linkedId] = useState(() => {
    const id =
      typeof window === 'undefined'
        ? null
        : new URLSearchParams(window.location.search).get('clip');
    return videos.some((video) => video.id === id) ? id : null;
  });
  const [visited, setVisited] = useState<VideoItem[]>(() => {
    if (linkedId) return videos.filter((video) => video.id === linkedId);
    const resumed = feedSession.visitedIds.flatMap(
      (id) => videos.find((video) => video.id === id) || [],
    );
    return resumed.length
      ? resumed
      : rankVideos(videos, learner, { random: () => 0.5 }).slice(0, 1);
  });
  const queue = useMemo(
    () => [
      ...visited,
      ...rankVideos(videos, learner, {
        excludeIds: visited.map((video) => video.id),
        random: () => 0.5,
      }),
    ],
    [visited, learner],
  );
  const [activeId, setActiveId] = useState(linkedId || feedSession.activeId || queue[0]?.id);
  const activeIndex = Math.max(
    0,
    queue.findIndex((video) => video.id === activeId),
  );
  const [selection, setSelection] = useState<Selection | null>(null);
  const [shareUrl, setShareUrl] = useState('');
  const [studying, setStudying] = useState(false);
  const [scan, setScan] = useState<{ video: VideoItem; image: string | null } | null>(null);
  const [tutor, setTutor] = useState<VideoItem | null>(null);
  const [transcript, setTranscript] = useState<{ video: VideoItem; time: number } | null>(null);
  const [seek, setSeek] = useState<{ videoId: string; time: number; key: number } | null>(null);
  const [transcriptAssistance, setTranscriptAssistance] = useState<
    Record<string, { wordTaps: number; translationOpened: boolean }>
  >({});
  const recordTranscriptHelp = (videoId: string, wordTap = false, translated = false) => {
    setTranscriptAssistance((previous) => ({
      ...previous,
      [videoId]: {
        wordTaps: (previous[videoId]?.wordTaps || 0) + Number(wordTap),
        translationOpened: !!previous[videoId]?.translationOpened || translated,
      },
    }));
  };
  const feed = useRef<HTMLDivElement>(null);
  const restored = useRef(false);
  const isSheetOpen =
    (!!selection && !selection.inline) ||
    !!tutor ||
    !!transcript ||
    !!shareUrl ||
    studying ||
    !!scan;
  const currentSession = useRef({ activeId, visitedIds: visited.map((video) => video.id) });
  useEffect(() => {
    currentSession.current = { activeId, visitedIds: visited.map((video) => video.id) };
  }, [activeId, visited]);
  useEffect(() => () => updateFeedSession(currentSession.current), [updateFeedSession]);
  const recentComprehension = learner.comprehensionHistory.slice(-5);
  const comprehension = recentComprehension.length
    ? Math.round(
        (recentComprehension.reduce((a, b) => a + b, 0) / recentComprehension.length) * 100,
      )
    : null;
  const levelIndex = Math.min(4, Math.floor(learner.ability) - 1);
  const level = ['A1', 'A2', 'B1', 'B2', 'C1'][levelIndex];
  useEffect(() => {
    const element = feed.current;
    if (!element || isSheetOpen) return;
    if (!restored.current) {
      element.scrollTop = activeIndex * element.clientHeight;
      restored.current = true;
    }
    const resize = new ResizeObserver(() => {
      const index = queue.findIndex((video) => video.id === currentSession.current.activeId);
      if (index >= 0) element.scrollTo({ top: index * element.clientHeight, behavior: 'instant' });
    });
    resize.observe(element);
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting && entry.intersectionRatio > 0.65)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const id = (visible.target as HTMLElement).dataset.videoId;
        if (!id) return;
        const index = queue.findIndex((video) => video.id === id);
        if (id !== currentSession.current.activeId) setSelection(null);
        setActiveId(id);
        setVisited((previous) => (index >= previous.length ? queue.slice(0, index + 1) : previous));
      },
      { root: element, threshold: [0.65, 0.85] },
    );
    element.querySelectorAll('.video-card').forEach((card) => observer.observe(card));
    return () => {
      observer.disconnect();
      resize.disconnect();
    };
  }, [queue, isSheetOpen, activeIndex]);
  const move = (direction: number) => {
    if (isSheetOpen) return;
    const element = feed.current;
    if (!element) return;
    const index = Math.max(0, Math.min(queue.length - 1, activeIndex + direction));
    element.scrollTo({
      top: index * element.clientHeight,
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'instant'
        : 'smooth',
    });
  };
  const selectionHandler = (
    word: CaptionWord,
    caption: CaptionSegment,
    video: VideoItem,
    inline = true,
  ) => {
    const lemma = lookupVocabulary(word.surface, caption.text)?.lemma || word.lemma || word.surface;
    const existing = learner.savedWords.find(
      (saved) => saved.lemma.toLocaleLowerCase('es') === lemma.toLocaleLowerCase('es'),
    );
    if (existing) saveWord(existing);
    setSelection({ word, caption, video, inline });
  };
  const shareVideo = async (video: VideoItem) => {
    const url = new URL('/feed', window.location.origin);
    url.searchParams.set('clip', video.id);
    try {
      if (navigator.share) {
        await navigator.share({ title: video.title, url: url.href });
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url.href);
        notify('Video link copied.');
      } else setShareUrl(url.href);
    } catch (error) {
      if (!(error instanceof DOMException && error.name === 'AbortError')) setShareUrl(url.href);
    }
  };
  return (
    <main className="feed-stage" id="main">
      <aside className="feed-intro">
        <h1>
          Your world.
          <br />
          In <span>Spanish.</span>
        </h1>
        <p>
          A coffee order. A new place.
          <br />A little more understanding.
        </p>
        <div className="personalization">
          <h2>Made for your curiosity</h2>
          <div className="interest-tags">
            {learner.interests.slice(0, 4).map((interest) => (
              <span key={interest}>{interest}</span>
            ))}
          </div>
          <Link href="/profile" className="text-link">
            Your learning space <ArrowUpRight size={14} />
          </Link>
        </div>
        <div className="desktop-tip">
          <span className="tip-icon">
            <BookOpen size={20} strokeWidth={1.5} />
          </span>
          <p>
            Don’t know a word?
            <br />
            <strong>Tap it. Make it yours.</strong>
          </p>
        </div>
      </aside>
      <section className="phone-stage" aria-label="Spanish video feed">
        <div className="phone-topline">
          <span>Find your everyday Spanish</span>
          <Headphones size={16} aria-hidden="true" />
        </div>
        <div className="phone-frame">
          <div
            className="video-feed"
            ref={feed}
            tabIndex={0}
            role="region"
            aria-label="Video feed. Use up and down arrows to change video."
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget) return;
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                move(event.key === 'ArrowDown' ? 1 : -1);
              }
            }}
          >
            {queue.map((video, index) => (
              <VideoCard
                key={video.id}
                video={video}
                active={video.id === activeId}
                near={Math.abs(index - activeIndex) <= 1}
                suspended={isSheetOpen}
                muted={preferences.muted}
                liked={preferences.likedVideoIds.includes(video.id)}
                onLike={() => toggleLike(video.id)}
                assisted={preferences.englishCaptions}
                onAssisted={() =>
                  updatePreferences({ englishCaptions: !preferences.englishCaptions })
                }
                playbackRate={preferences.playbackRate}
                initialTime={feedSession.timeByVideoId[video.id] || 0}
                initialEvidence={feedSession.evidenceByVideoId[video.id]}
                onPosition={(time, evidence) => {
                  updateFeedSession({
                    timeByVideoId: { [video.id]: time },
                    evidenceByVideoId: { [video.id]: evidence },
                  });
                }}
                seekTo={seek?.videoId === video.id ? seek : undefined}
                transcriptAssistance={transcriptAssistance[video.id]}
                onTranscript={(item, time) => {
                  setSelection(null);
                  recordTranscriptHelp(item.id, false, preferences.englishCaptions);
                  setTranscript({ video: item, time });
                }}
                onDifficulty={() => {
                  adjustDifficulty('easier');
                  notify(
                    learner.ability <= 1
                      ? 'You’re at the gentlest level. Try English captions or a slower speed in settings.'
                      : 'We’ll bring you easier Spanish in the next clips.',
                  );
                }}
                savedCount={learner.savedWords.filter((word) => word.videoId === video.id).length}
                onMute={() => updatePreferences({ muted: !preferences.muted })}
                onWord={selectionHandler}
                onTutor={(video) => {
                  setSelection(null);
                  setTutor(video);
                }}
                onShare={shareVideo}
                onFlashcards={() => {
                  setSelection(null);
                  setStudying(true);
                }}
                onScan={(video, image) => {
                  setSelection(null);
                  setScan({ video, image });
                }}
                onEvent={recordWatch}
              />
            ))}
          </div>
          {selection?.inline && selection.video.id === activeId && !isSheetOpen && (
            <WordPopover
              key={`${selection.video.id}-${selection.caption.start}-${selection.word.surface}`}
              {...selection}
              onClose={() => setSelection(null)}
            />
          )}
          <BottomNav />
          <div className="mobile-skip">
            <button
              className="video-control"
              onClick={() => move(-1)}
              disabled={activeIndex === 0}
              aria-label="Previous video"
            >
              <ArrowUp size={17} />
            </button>
            <button
              className="video-control"
              onClick={() => move(1)}
              disabled={activeIndex === queue.length - 1}
              aria-label="Next video"
            >
              <ArrowDown size={17} />
            </button>
          </div>
        </div>
        <div className="phone-bottomline">
          <span>
            <span className="tiny-loop">∞</span> A little better, every loop.
          </span>
          <span>
            {activeIndex + 1} / {queue.length}
          </span>
        </div>
        <div className="feed-paging">
          <button
            className="paging-button"
            disabled={activeIndex === 0}
            onClick={() => move(-1)}
            aria-label="Previous video"
          >
            <ArrowUp size={20} />
          </button>
          <button
            className="paging-button"
            disabled={activeIndex === queue.length - 1}
            onClick={() => move(1)}
            aria-label="Next video"
          >
            <ArrowDown size={20} />
          </button>
        </div>
      </section>
      <aside className="feed-progress">
        <div className="progress-top">
          <span className="session-symbol">
            <Sparkles size={18} strokeWidth={1.7} />
          </span>
          <span>Your learning rhythm</span>
        </div>
        <div className="current-level">
          <span className="level-number">{level}</span>
          <div>
            <strong>
              {
                [
                  'Getting started',
                  'Finding your feet',
                  'Making conversation',
                  'Going deeper',
                  'Feeling fluent',
                ][levelIndex]
              }
            </strong>
            <span>
              {
                ['Beginner', 'Elementary', 'Intermediate', 'Upper intermediate', 'Advanced'][
                  levelIndex
                ]
              }
            </span>
          </div>
        </div>
        <ProgressBar
          value={learner.ability >= 5 ? 100 : (learner.ability % 1) * 100}
          label={`Progress through ${level}`}
        />
        <div className="level-markers">
          <span>{level}</span>
          <span>{['A2', 'B1', 'B2', 'C1', 'C1'][levelIndex]}</span>
        </div>
        <p className="adaptive-note">
          {recentComprehension.length < 3
            ? 'Just watch. We’ll find your pace together.'
            : 'Your next moments adjust as you learn.'}
        </p>
        <div className="session-stats">
          <div>
            <span>Clips explored</span>
            <strong>{learner.watchedVideoIds.length}</strong>
          </div>
          <div>
            <span>Words collected</span>
            <strong>{learner.savedWords.length}</strong>
          </div>
          <div>
            <span>Understanding</span>
            <strong>{comprehension === null ? 'Getting to know you' : `${comprehension}%`}</strong>
          </div>
        </div>
        {learner.savedWords.length > 0 && (
          <Link href="/learn" className="words-nudge">
            <Check size={16} />
            <span>Your words are waiting</span>
            <ArrowUpRight size={15} />
          </Link>
        )}
        <div className="keyboard-tip">
          <kbd>↑</kbd>
          <kbd>↓</kbd>
          <span>to explore</span>
          <kbd>space</kbd>
          <span>to pause</span>
        </div>
      </aside>
      {transcript && (
        <TranscriptSheet
          {...transcript}
          assisted={preferences.englishCaptions}
          onAssisted={() => {
            recordTranscriptHelp(transcript.video.id, false, !preferences.englishCaptions);
            updatePreferences({ englishCaptions: !preferences.englishCaptions });
          }}
          onWord={(word, caption, video) => {
            recordTranscriptHelp(video.id, true);
            selectionHandler(word, caption, video, false);
          }}
          onReplay={(time) => {
            setSeek({ videoId: transcript.video.id, time, key: Date.now() });
            setTranscript(null);
          }}
          onClose={() => setTranscript(null)}
        />
      )}
      {studying && (
        <Flashcards
          words={learner.savedWords}
          immersive
          onClose={() => setStudying(false)}
          onWatchContext={(word) => {
            const index = queue.findIndex((video) => video.id === word.videoId);
            if (index < 0) {
              notify('This word’s original clip is no longer in this feed.');
              return;
            }
            const video = queue[index];
            const segment = video.transcript.find(
              (caption) => caption.text === word.contextSentence,
            );
            setActiveId(video.id);
            setSeek({ videoId: video.id, time: segment?.start || 0, key: Date.now() });
            if (feed.current) feed.current.scrollTop = index * feed.current.clientHeight;
            setStudying(false);
          }}
        />
      )}
      {scan && (
        <ScanSheet
          {...scan}
          onClose={() => setScan(null)}
          onWord={(word, caption, video) => selectionHandler(word, caption, video, false)}
        />
      )}
      {shareUrl && (
        <Sheet titleId="share-title" onClose={() => setShareUrl('')}>
          <h2 id="share-title">Share video</h2>
          <label className="share-link-field">
            Copy this video link
            <input value={shareUrl} readOnly onFocus={(event) => event.currentTarget.select()} />
          </label>
        </Sheet>
      )}
      {selection && !selection.inline && (
        <WordSheet
          key={`${selection.video.id}-${selection.caption.start}-${selection.word.surface}`}
          {...selection}
          onClose={() => setSelection(null)}
        />
      )}
      {tutor && <TutorSheet video={tutor} onClose={() => setTutor(null)} />}
    </main>
  );
}
