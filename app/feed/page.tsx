'use client';
import { AppShell } from '@/components/AppShell';
import { VideoFeed } from '@/components/VideoFeed';
import { useLearner } from '@/components/LearnerProvider';
export default function FeedPage() {
  const { learner } = useLearner();
  return <AppShell feed>{learner && <VideoFeed learner={learner} />}</AppShell>;
}
