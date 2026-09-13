'use client';
import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, ArrowUpRight, Bookmark, BookOpen, Check, Search, X } from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { useLearner } from '@/components/LearnerProvider';
import { Sheet } from '@/components/Sheet';
import { Flashcards } from '@/components/Flashcards';
import { buildReview } from '@/lib/review';
import type { SavedWord } from '@/lib/types';

function QuickReview({ words, onClose }: { words: SavedWord[]; onClose: () => void }) {
  const questions = useMemo(() => buildReview(words), [words]);
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (index > 0) heading.current?.focus();
  }, [index]);
  const question = questions[index];
  const finished = index >= questions.length;
  return (
    <Sheet titleId="review-title" onClose={onClose} className="review-sheet">
      {finished ? (
        <div className="review-complete">
          <span className="complete-symbol">
            <Check size={32} />
          </span>
          <h2 id="review-title" ref={heading} tabIndex={-1}>
            Look at you go.
          </h2>
          <p>
            You answered {correct} of {questions.length} questions correctly.
            <br />
            Every encounter helps them stick.
          </p>
          <button className="button primary full-width" onClick={onClose}>
            Keep exploring
            <ArrowRight size={18} />
          </button>
        </div>
      ) : (
        <>
          <div className="review-topline">
            <span>Quick review</span>
            <span>
              {index + 1} of {questions.length}
            </span>
          </div>
          <div className="review-steps">
            {questions.map((_, i) => (
              <span key={i} className={i <= index ? 'active' : ''} />
            ))}
          </div>
          <h2 id="review-title" ref={heading} tabIndex={-1}>
            {question.prompt}
          </h2>
          <p className="review-context">{question.context}</p>
          <div className="review-choices">
            {question.choices.map((answer) => (
              <button
                key={answer}
                disabled={choice !== null}
                className={`review-option${choice !== null && answer === question.answer ? ' correct' : ''}${choice === answer && answer !== question.answer ? ' incorrect' : ''}`}
                onClick={() => {
                  setChoice(answer);
                  if (answer === question.answer) setCorrect((value) => value + 1);
                }}
              >
                <span>{answer}</span>
                {choice !== null && answer === question.answer && <Check size={19} />}
                {choice === answer && answer !== question.answer && <X size={18} />}
              </button>
            ))}
          </div>
          {choice !== null && (
            <div className="review-feedback" aria-live="polite">
              <p>
                {choice === question.answer
                  ? 'That’s the one. Nicely remembered.'
                  : `Almost. The answer is “${question.answer}”.`}
              </p>
              <button
                className="button primary full-width"
                onClick={() => {
                  setChoice(null);
                  setIndex((value) => value + 1);
                }}
              >
                {index === questions.length - 1 ? 'See how you did' : 'Next question'}
                <ArrowRight size={18} />
              </button>
            </div>
          )}
        </>
      )}
    </Sheet>
  );
}

export default function LearnPage() {
  const { learner } = useLearner();
  const [search, setSearch] = useState('');
  const [reviewing, setReviewing] = useState(false);
  const [studying, setStudying] = useState(false);
  const words = learner?.savedWords || [];
  const filtered = words.filter((word) =>
    `${word.surface} ${word.lemma} ${word.translation}`
      .toLocaleLowerCase()
      .includes(search.toLocaleLowerCase()),
  );
  return (
    <AppShell>
      <main className="collection-page" id="main">
        <header className="page-heading">
          <span className="page-heading-icon">
            <BookOpen size={26} strokeWidth={1.5} />
          </span>
          <h1>
            A few words.
            <br />
            <span>A bigger world.</span>
          </h1>
          <p>Your Spanish, collected one moment at a time.</p>
        </header>
        {words.length > 0 ? (
          <>
            <section className="review-banner">
              <div>
                <h2>Make them yours.</h2>
                <p>Revisit a word, or try three quick questions.</p>
              </div>
              <div className="study-actions">
                <button className="button secondary" onClick={() => setStudying(true)}>
                  Flashcards
                  <BookOpen size={17} aria-hidden="true" />
                </button>
                <button className="button primary" onClick={() => setReviewing(true)}>
                  Quick review
                  <ArrowRight size={17} />
                </button>
              </div>
            </section>
            <div className="collection-toolbar">
              <h2>
                Your words <span>{words.length}</span>
              </h2>
              <div className="word-search">
                <Search size={17} />
                <label className="sr-only" htmlFor="word-search">
                  Search saved words
                </label>
                <input
                  id="word-search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Find a word"
                />
                {search && (
                  <button aria-label="Clear search" onClick={() => setSearch('')}>
                    <X size={16} />
                  </button>
                )}
              </div>
            </div>
            <div className="vocabulary-list">
              {filtered.map((word) => (
                <article className="vocabulary-item" key={word.id}>
                  <div className="vocabulary-header">
                    <div>
                      <h3 lang="es">{word.surface}</h3>
                      <span className="vocabulary-lemma">{word.lemma}</span>
                    </div>
                    <span className="encounter-count">
                      {word.encounters} {word.encounters === 1 ? 'encounter' : 'encounters'}
                    </span>
                  </div>
                  <p className="vocabulary-translation">{word.translation}</p>
                  <p className="vocabulary-context" lang="es">
                    “{word.contextSentence}”
                  </p>
                </article>
              ))}
            </div>
            {filtered.length === 0 && (
              <div className="search-empty">
                <Search size={24} />
                <h2>No words found.</h2>
                <p>Try another word or translation.</p>
                <button className="button secondary" onClick={() => setSearch('')}>
                  Clear search
                </button>
              </div>
            )}
          </>
        ) : (
          <section className="empty-collection">
            <div className="empty-word-mark">
              <Bookmark size={36} strokeWidth={1.2} />
            </div>
            <h2>Your first word is out there.</h2>
            <p>
              Tap a subtitle in the feed, explore its meaning, and save it here. Your collection
              grows with your curiosity.
            </p>
            <Link className="button primary" href="/feed">
              Find a word
              <ArrowRight size={18} />
            </Link>
            <span className="empty-footnote">A moment of curiosity is all it takes.</span>
          </section>
        )}
        <Link href="/feed" className="collection-footer">
          Back to your Spanish moments
          <ArrowUpRight size={16} />
        </Link>
        {reviewing && words.length > 0 && (
          <QuickReview words={words} onClose={() => setReviewing(false)} />
        )}
        {studying && words.length > 0 && (
          <Flashcards words={words} onClose={() => setStudying(false)} />
        )}
      </main>
    </AppShell>
  );
}
