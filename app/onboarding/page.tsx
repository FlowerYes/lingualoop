'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowRight,
  ArrowLeft,
  Check,
  Coffee,
  Compass,
  Utensils,
  Music2,
  Mountain,
  Sun,
  Globe2,
  LockKeyhole,
} from 'lucide-react';
import { Brand } from '@/components/Brand';
import { useLearner } from '@/components/LearnerProvider';
import { LoadingScreen } from '@/components/AppShell';
const interests = [
  { name: 'Food', icon: Utensils, hint: 'One delicious discovery at a time' },
  { name: 'Travel', icon: Compass, hint: 'Near, far, and everywhere between' },
  { name: 'Culture', icon: Sun, hint: 'The stories behind the everyday' },
  { name: 'Everyday', icon: Coffee, hint: 'Little moments, real conversations' },
  { name: 'Nature', icon: Mountain, hint: 'Take the scenic route' },
  { name: 'Music', icon: Music2, hint: 'Find the words in your rhythm' },
];
const levels = [
  { code: 'A1', title: 'Just beginning', description: 'Hola is a pretty good start.' },
  { code: 'A2', title: 'I know the basics', description: 'Simple sentences feel familiar.' },
  { code: 'B1', title: 'I can get by', description: 'I can keep a conversation going.' },
  { code: 'B2', title: 'Pretty comfortable', description: 'I understand more than I miss.' },
  { code: 'C1', title: 'Nearly fluent', description: 'Ready for the subtleties.' },
];
export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [language, setLanguage] = useState('es');
  const [ability, setAbility] = useState(1);
  const [selected, setSelected] = useState<string[]>([]);
  const { onboard, learner, ready } = useLearner();
  const router = useRouter();
  const feedDestination = () => {
    const clip = new URLSearchParams(window.location.search).get('clip');
    return clip ? `/feed?clip=${encodeURIComponent(clip)}` : '/feed';
  };
  useEffect(() => {
    if (ready && learner) {
      const clip = new URLSearchParams(window.location.search).get('clip');
      router.replace(clip ? `/feed?clip=${encodeURIComponent(clip)}` : '/feed');
    }
  }, [ready, learner, router]);
  const next = () => {
    if (step < 2) setStep((value) => value + 1);
    else {
      onboard(ability, selected);
      router.replace(feedDestination());
    }
  };
  if (!ready || learner) return <LoadingScreen />;
  return (
    <div className="onboarding">
      <header className="onboarding-header">
        <Brand />
        <span>A little more possibility.</span>
      </header>
      <main className="onboarding-main">
        <section className="onboarding-photo">
          <Image
            src="/media/cafe.webp"
            fill
            sizes="(max-width: 767px) 1px, 45vw"
            alt="A coffee on a sunny terrace overlooking a Madrid street"
            priority
          />
          <div className="onboarding-photo-shade" />
          <div className="onboarding-photo-copy">
            <p lang="es">Un café, por favor.</p>
            <span>
              Your next conversation
              <br />
              starts with a little curiosity.
            </span>
          </div>
        </section>
        <section className="onboarding-content">
          <div className="onboarding-progress" aria-label={`Setup step ${step + 1} of 3`}>
            {['Language', 'Your level', 'Interests'].map((label, index) => (
              <div key={label} className={index <= step ? 'complete' : ''}>
                <span className="step-line" />
                <span>{label}</span>
              </div>
            ))}
          </div>
          <div className="onboarding-step" key={step}>
            <h1>
              {
                [
                  'A new language.\nA new perspective.',
                  'Where are you\nwith Spanish?',
                  'Follow your\ncuriosity.',
                ][step]
              }
            </h1>
            <p className="onboarding-description">
              {
                [
                  'Start with Spanish. Discover the world, one short video at a time.',
                  'No tests here. Pick what feels right. We’ll find your pace as you watch.',
                  'Choose a few things you love. We’ll bring the Spanish.',
                ][step]
              }
            </p>
            {step === 0 ? (
              <div className="language-options">
                <button
                  className={language === 'es' ? 'choice selected' : 'choice'}
                  aria-pressed={language === 'es'}
                  onClick={() => setLanguage('es')}
                >
                  <span className="language-monogram">Es</span>
                  <span className="choice-copy">
                    <strong>Spanish</strong>
                    <span>Español</span>
                  </span>
                  <span className="selection-check">
                    <Check size={16} />
                  </span>
                </button>
                <button className="choice unavailable" disabled>
                  <span className="language-monogram">Fr</span>
                  <span className="choice-copy">
                    <strong>French</strong>
                    <span>Français</span>
                  </span>
                  <span className="coming-soon">Coming soon</span>
                </button>
                <button className="choice unavailable" disabled>
                  <span className="language-monogram" lang="ja">
                    あ
                  </span>
                  <span className="choice-copy">
                    <strong>Japanese</strong>
                    <span>日本語</span>
                  </span>
                  <span className="coming-soon">Coming soon</span>
                </button>
              </div>
            ) : step === 1 ? (
              <div className="level-options">
                {levels.map((level, index) => (
                  <button
                    className={
                      ability === index + 1 ? 'choice level-choice selected' : 'choice level-choice'
                    }
                    key={level.code}
                    aria-pressed={ability === index + 1}
                    onClick={() => setAbility(index + 1)}
                  >
                    <span className="level-code">{level.code}</span>
                    <span className="choice-copy">
                      <strong>{level.title}</strong>
                      <span>{level.description}</span>
                    </span>
                    {ability === index + 1 && (
                      <span className="selection-check">
                        <Check size={15} />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            ) : (
              <div className="interest-options">
                {interests.map(({ name, icon: Icon, hint }) => (
                  <button
                    key={name}
                    className={
                      selected.includes(name) ? 'interest-choice selected' : 'interest-choice'
                    }
                    aria-pressed={selected.includes(name)}
                    title={hint}
                    onClick={() =>
                      setSelected((items) =>
                        items.includes(name)
                          ? items.filter((item) => item !== name)
                          : [...items, name],
                      )
                    }
                  >
                    <Icon size={25} strokeWidth={1.5} />
                    <span>{name}</span>
                    {selected.includes(name) && <Check className="interest-check" size={15} />}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="onboarding-actions">
            {step > 0 && (
              <button
                className="back-button"
                onClick={() => setStep((value) => value - 1)}
                aria-label="Previous step"
              >
                <ArrowLeft size={20} />
              </button>
            )}
            <button
              className="button primary"
              onClick={next}
              disabled={step === 2 && selected.length === 0}
            >
              {step === 2 ? 'Find my feed' : 'Continue'}
              <ArrowRight size={18} />
            </button>
          </div>
          <p className="onboarding-footnote">
            {step === 2 ? (
              <>
                <Globe2 size={14} />A feed that feels like you. In Spanish.
              </>
            ) : (
              <>
                <LockKeyhole size={13} />
                No account. Just curiosity.
              </>
            )}
          </p>
        </section>
      </main>
    </div>
  );
}
