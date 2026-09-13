'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowRight,
  BookOpen,
  Clock3,
  Globe2,
  Monitor,
  Moon,
  Play,
  RotateCcw,
  Sun,
  TrendingUp,
  Check,
  ChevronRight,
} from 'lucide-react';
import { AppShell } from '@/components/AppShell';
import { useLearner } from '@/components/LearnerProvider';
import { ProgressBar } from '@/components/ProgressBar';
import { Sheet } from '@/components/Sheet';
import { LEARNING_INTERESTS } from '@/lib/learner';
import { PLAYBACK_RATES } from '@/lib/mobile-preferences';
import type { LearnerState } from '@/lib/types';
const levelNames = ['Beginner', 'Elementary', 'Intermediate', 'Upper intermediate', 'Advanced'];
const levelCodes = ['A1', 'A2', 'B1', 'B2', 'C1'];

function LearningSettings({
  learner,
  onSave,
  onClose,
}: {
  learner: LearnerState;
  onSave: (ability: number, interests: string[]) => void;
  onClose: () => void;
}) {
  const [ability, setAbility] = useState(learner.ability);
  const [interests, setInterests] = useState([...learner.interests]);
  return (
    <Sheet titleId="learning-settings-title" onClose={onClose} className="learning-settings-sheet">
      <h2 id="learning-settings-title">Find your pace.</h2>
      <p className="sheet-description">
        Choose a starting level and the things you enjoy. Your next clips will adjust from here.
      </p>
      <form
        className="learning-settings-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (interests.length) onSave(ability, interests);
        }}
      >
        <div className="settings-field">
          <label htmlFor="learning-level">Spanish level</label>
          <select
            id="learning-level"
            className="settings-select"
            value={Math.floor(ability)}
            onChange={(event) => setAbility(Number(event.target.value))}
          >
            {levelNames.map((name, index) => (
              <option key={name} value={index + 1}>
                {levelCodes[index]} · {name}
              </option>
            ))}
          </select>
        </div>
        <fieldset className="settings-interests">
          <legend>Your interests</legend>
          <p id="interests-hint">Choose at least one.</p>
          <div className="settings-interest-grid" aria-describedby="interests-hint">
            {LEARNING_INTERESTS.map((interest) => {
              const selected = interests.includes(interest);
              return (
                <button
                  key={interest}
                  type="button"
                  className={`settings-interest${selected ? ' selected' : ''}`}
                  aria-pressed={selected}
                  onClick={() =>
                    setInterests((values) =>
                      selected
                        ? values.filter((value) => value !== interest)
                        : [...values, interest],
                    )
                  }
                >
                  <span>{interest[0].toUpperCase() + interest.slice(1)}</span>
                  {selected && <Check size={16} aria-hidden="true" />}
                </button>
              );
            })}
          </div>
        </fieldset>
        <div className="settings-form-actions">
          <button
            type="submit"
            className="button primary full-width"
            disabled={interests.length === 0}
          >
            Save changes
          </button>
          <button type="button" className="button secondary full-width" onClick={onClose}>
            Cancel
          </button>
        </div>
      </form>
    </Sheet>
  );
}

export default function ProfilePage() {
  const { learner, preferences, updatePreferences, updateLearning, notify, reset } = useLearner();
  const router = useRouter();
  const [resetting, setResetting] = useState(false);
  const [editingLearning, setEditingLearning] = useState(false);
  const current = Math.min(4, Math.max(0, Math.floor(learner?.ability || 1) - 1));
  const scores = learner?.comprehensionHistory.slice(-5) || [];
  const comprehension = scores.length
    ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100)
    : null;
  return (
    <AppShell>
      <main className="profile-page" id="main">
        <header className="page-heading">
          <span className="profile-monogram" lang="es">
            Tú.
          </span>
          <h1>
            A little more
            <br />
            <span>you, in Spanish.</span>
          </h1>
          <p>No perfect streaks. Just real progress.</p>
        </header>
        <section className="profile-level">
          <div className="profile-level-heading">
            <div>
              <Globe2 size={18} />
              <span>Learning Spanish</span>
            </div>
            <button
              className="profile-edit-button"
              onClick={() => setEditingLearning(true)}
              aria-label="Change your Spanish level"
            >
              Change level <ChevronRight size={14} aria-hidden="true" />
            </button>
          </div>
          <div className="profile-level-main">
            <span>{levelCodes[current]}</span>
            <div>
              <h2>{levelNames[current]}</h2>
              <p>
                {scores.length < 3
                  ? 'We’re getting to know your Spanish.'
                  : 'Your level grows with your understanding.'}
              </p>
            </div>
          </div>
          <ProgressBar
            segments
            value={(learner?.ability || 1) >= 5 ? 100 : ((learner?.ability || 1) % 1) * 100}
            label={`Progress from ${levelCodes[current]} to ${levelCodes[Math.min(current + 1, 4)]}`}
          />
          <div className="level-markers">
            <span>{levelCodes[current]}</span>
            <span>{current === 4 ? 'Keep exploring' : `Next: ${levelCodes[current + 1]}`}</span>
          </div>
        </section>
        <section className="profile-stat-grid" aria-label="Learning statistics">
          <div>
            <Clock3 size={19} />
            <strong>
              {Math.floor((learner?.totalWatchSeconds || 0) / 60)}
              <span>min</span>
            </strong>
            <p>Time immersed</p>
            <span className="stat-detail">
              {Math.round(learner?.totalWatchSeconds || 0)} seconds of Spanish
            </span>
          </div>
          <div>
            <Play size={19} />
            <strong>{learner?.watchedVideoIds.length || 0}</strong>
            <p>Clips explored</p>
            <span className="stat-detail">Watched at least 80%</span>
          </div>
          <div>
            <BookOpen size={19} />
            <strong>{learner?.savedWords.length || 0}</strong>
            <p>Words collected</p>
            <span className="stat-detail">A vocabulary that’s yours</span>
          </div>
          <div>
            <TrendingUp size={19} />
            <strong>
              {comprehension === null ? '…' : comprehension}
              <span>{comprehension !== null && '%'}</span>
            </strong>
            <p>Understanding</p>
            <span className="stat-detail">
              {comprehension === null
                ? 'Watch a clip to find your pace'
                : 'Estimated from recent viewing'}
            </span>
          </div>
        </section>
        <section className="profile-interests">
          <div className="profile-section-heading">
            <h2>Your kind of Spanish</h2>
            <button className="profile-edit-button" onClick={() => setEditingLearning(true)}>
              Edit interests
            </button>
          </div>
          <p>These interests shape the moments in your feed.</p>
          <div className="interest-tags">
            {learner?.interests.map((interest) => (
              <span key={interest}>{interest}</span>
            ))}
          </div>
        </section>
        <section className="profile-settings">
          <div className="settings-row">
            <div>
              <h2 id="english-captions-label">English captions</h2>
              <p>Show translations beneath the Spanish.</p>
            </div>
            <button
              type="button"
              className={`settings-toggle${preferences.englishCaptions ? ' selected' : ''}`}
              role="switch"
              aria-checked={preferences.englishCaptions}
              aria-labelledby="english-captions-label"
              onClick={() => updatePreferences({ englishCaptions: !preferences.englishCaptions })}
            >
              <span>{preferences.englishCaptions ? 'On' : 'Off'}</span>
            </button>
          </div>
          <div className="settings-row">
            <div>
              <label htmlFor="playback-speed">Playback speed</label>
              <p>A little slower, or a little faster.</p>
            </div>
            <select
              id="playback-speed"
              className="settings-select playback-speed-select"
              value={preferences.playbackRate}
              onChange={(event) => updatePreferences({ playbackRate: Number(event.target.value) })}
            >
              {PLAYBACK_RATES.map((rate) => (
                <option value={rate} key={rate}>
                  {rate === 1 ? '1× Normal' : `${rate}×`}
                </option>
              ))}
            </select>
          </div>
          <div className="appearance-row">
            <div>
              <h2>Make yourself comfortable</h2>
              <p>Choose your appearance.</p>
            </div>
            <div className="theme-switch" aria-label="Appearance">
              {(
                [
                  { name: 'Light', value: 'light', icon: Sun },
                  { name: 'System', value: 'system', icon: Monitor },
                  { name: 'Dark', value: 'dark', icon: Moon },
                ] as const
              ).map(({ name, value, icon: Icon }) => (
                <button
                  key={value}
                  className={preferences.theme === value ? 'selected' : ''}
                  aria-label={`${name} appearance`}
                  aria-pressed={preferences.theme === value}
                  onClick={() => updatePreferences({ theme: value })}
                >
                  <Icon size={17} />
                </button>
              ))}
            </div>
          </div>
          <div className="privacy-note">
            <h2>Just here, just yours.</h2>
            <p>
              Your words and progress live in this browser. No account needed. Explore three
              Spanish TikTok videos with their original audio and creator attribution.
            </p>
          </div>
          <button className="reset-action" onClick={() => setResetting(true)}>
            <RotateCcw size={16} />
            <span>Reset demo</span>
            <ArrowRight size={16} />
          </button>
        </section>
        {editingLearning && learner && (
          <LearningSettings
            learner={learner}
            onClose={() => setEditingLearning(false)}
            onSave={(ability, interests) => {
              updateLearning(ability, interests);
              setEditingLearning(false);
              notify('Your learning preferences are updated.');
            }}
          />
        )}
        {resetting && (
          <Sheet titleId="reset-title" onClose={() => setResetting(false)} className="reset-sheet">
            <span className="tutor-symbol">
              <RotateCcw size={22} />
            </span>
            <h2 id="reset-title">A fresh beginning?</h2>
            <p className="sheet-description">
              This clears your saved words, progress, and setup on this browser. You’ll start with a
              new feed.
            </p>
            <button
              className="button primary full-width"
              onClick={() => {
                setResetting(false);
                reset();
                router.replace('/onboarding');
              }}
            >
              Reset and start again
            </button>
            <button className="button secondary full-width" onClick={() => setResetting(false)}>
              Keep my progress
            </button>
          </Sheet>
        )}
      </main>
    </AppShell>
  );
}
