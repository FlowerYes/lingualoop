'use client';
import { useEffect, useRef, useState } from 'react';
import { ArrowUp, MessageCircle, Quote } from 'lucide-react';
import type { TutorAnswer, VideoItem } from '@/lib/types';
import { Sheet } from './Sheet';
import { useLearner } from './LearnerProvider';
import styles from './ImmersionPanels.module.css';
const prompts = [
  'Explain this video simply',
  'Which phrases should I remember?',
  'Explain the grammar',
];
export function TutorSheet({ video, onClose }: { video: VideoItem; onClose: () => void }) {
  const { learner } = useLearner();
  const [question, setQuestion] = useState('');
  const [messages, setMessages] = useState<{ question: string; result: TutorAnswer }[]>([]);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const inFlight = useRef(false);
  const request = useRef<AbortController | null>(null);
  const conversation = useRef<HTMLDivElement>(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {
    const element = conversation.current;
    if (element) element.scrollTop = element.scrollHeight;
  }, [messages, pending]);
  const transcript = video.transcript.map((s) => s.text).join(' ');
  async function ask(value: string) {
    if (!value.trim() || inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError('');
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 12000);
    try {
      const response = await fetch('/api/tutor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: value.trim(),
          transcript,
          translation: video.transcript.map((s) => s.translation).join(' '),
          learnerLevel: learner?.ability || 1,
        }),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('Tutor unavailable');
      const result: TutorAnswer = await response.json();
      setMessages((items) => [...items, { question: value.trim(), result }]);
      setQuestion('');
    } catch {
      setError('Your tutor couldn’t connect. Please try your question again.');
    } finally {
      clearTimeout(timeout);
      inFlight.current = false;
      setPending(false);
    }
  }
  return (
    <Sheet
      titleId="tutor-title"
      onClose={onClose}
      className={`tutor-sheet ${styles.panel} ${styles.tutorPanel} ${styles.fromRight}`}
      dismissDirection="right"
    >
      <span className="tutor-symbol">
        <MessageCircle size={23} />
      </span>
      <h2 id="tutor-title">Ask about this video</h2>
      <p className="sheet-description">Your Spanish tutor, right here in the moment.</p>
      <details className="transcript-context">
        <summary>
          <Quote size={15} />
          {video.title}
          <span>Transcript</span>
        </summary>
        <p lang="es">{transcript}</p>
      </details>
      <div className="tutor-conversation" ref={conversation} aria-live="polite" aria-busy={pending}>
        {messages.length === 0 && (
          <div className="suggested-prompts">
            {prompts.map((prompt) => (
              <button
                key={prompt}
                className="suggestion"
                disabled={pending}
                onClick={() => ask(prompt)}
              >
                {prompt}
                <ArrowUp size={15} />
              </button>
            ))}
          </div>
        )}
        {messages.map((message, i) => (
          <div className="tutor-exchange" key={i}>
            <p className="tutor-question">{message.question}</p>
            <div className="tutor-answer">
              <span className="context-label">
                {message.result.source === 'demo' ? 'Practice tutor' : 'LinguaLoop tutor'}
              </span>
              <p>{message.result.answer}</p>
            </div>
          </div>
        ))}
        {pending && (
          <div className="tutor-thinking" role="status">
            <span />
            <span />
            <span />
            <span className="sr-only">Your tutor is thinking</span>
          </div>
        )}
      </div>
      {error && (
        <p className="inline-error" role="alert">
          {error}
        </p>
      )}
      <form
        className="tutor-form"
        onSubmit={(event) => {
          event.preventDefault();
          ask(question);
        }}
      >
        <label htmlFor="tutor-question" className="sr-only">
          Ask about this video
        </label>
        <input
          id="tutor-question"
          value={question}
          onChange={(event) => setQuestion(event.target.value)}
          placeholder="Ask about this video…"
          maxLength={500}
          autoComplete="off"
          readOnly={pending}
        />
        <button type="submit" disabled={!question.trim() || pending} aria-label="Send question">
          <ArrowUp size={20} />
        </button>
      </form>
      <p className="sheet-footnote">Grounded in this video. Made for your level.</p>
    </Sheet>
  );
}
