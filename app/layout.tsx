import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/dm-sans';
import './globals.css';
import { LearnerProvider } from '@/components/LearnerProvider';

export const metadata: Metadata = {
  title: 'LinguaLoop | A little more Spanish',
  description:
    'Find your rhythm in Spanish. Watch short videos, explore the words, and learn a little more with every loop.',
  applicationName: 'LinguaLoop',
};
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  interactiveWidget: 'resizes-content',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f8f6f2' },
    { media: '(prefers-color-scheme: dark)', color: '#242522' },
  ],
};
export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" data-scroll-behavior="smooth">
      <body>
        <LearnerProvider>{children}</LearnerProvider>
      </body>
    </html>
  );
}
