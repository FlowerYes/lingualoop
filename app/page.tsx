'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useLearner } from '@/components/LearnerProvider';
import { LoadingScreen } from '@/components/AppShell';
export default function Home() {
  const { learner, ready } = useLearner();
  const router = useRouter();
  useEffect(() => {
    if (ready) router.replace(learner ? '/feed' : '/onboarding');
  }, [learner, ready, router]);
  return <LoadingScreen />;
}
