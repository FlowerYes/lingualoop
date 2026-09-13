import Link from 'next/link';
import { Brand } from '@/components/Brand';
export default function NotFound() {
  return (
    <main className="error-page">
      <Brand />
      <h1>A little off course.</h1>
      <p>This page isn’t here. Your next Spanish moment is.</p>
      <Link href="/feed" className="button primary">
        Back to feed
      </Link>
    </main>
  );
}
