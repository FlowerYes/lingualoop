'use client';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-page">
      <h1>Let’s try that again.</h1>
      <p>Something interrupted this page. Your saved words are still on this device.</p>
      <button className="button primary" onClick={reset}>
        Try again
      </button>
    </main>
  );
}
