'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Globe2 } from 'lucide-react';
import { Brand } from './Brand';
import { BottomNav } from './BottomNav';
import { useLearner } from './LearnerProvider';
import { AdaptiveToast } from './AdaptiveToast';

export function AppShell({
  children,
  feed = false,
}: {
  children: React.ReactNode;
  feed?: boolean;
}) {
  const { learner, ready, persistenceError } = useLearner();
  const router = useRouter();
  useEffect(() => {
    if (ready && !learner) {
      const clip = new URLSearchParams(window.location.search).get('clip');
      router.replace(clip ? `/onboarding?clip=${encodeURIComponent(clip)}` : '/onboarding');
    }
  }, [ready, learner, router]);
  if (!ready || !learner) return <LoadingScreen />;
  return (
    <div className={feed ? 'app-shell feed-shell' : 'app-shell'}>
      <a className="skip-link" href="#main">
        Skip to content
      </a>
      <header className="app-header">
        <Brand />
        <BottomNav desktop />
        <div className="language-indicator">
          <Globe2 size={16} aria-hidden="true" />
          <span>Learning Spanish</span>
          <span className="language-code">ES</span>
        </div>
      </header>
      {persistenceError && (
        <p className="storage-warning" role="status">
          Your browser couldn’t save progress. Keep this tab open or enable site storage.
        </p>
      )}
      {children}
      <BottomNav />
      <AdaptiveToast />
    </div>
  );
}
export function LoadingScreen() {
  return (
    <div className="loading-screen" aria-label="Loading LinguaLoop">
      <Brand />
      <div className="skeleton-player" />
      <span className="sr-only">Loading your learning space</span>
    </div>
  );
}
