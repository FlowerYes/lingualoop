import { Infinity as LoopIcon } from 'lucide-react';
import Link from 'next/link';

export function Brand() {
  return (
    <Link href="/" className="brand" aria-label="LinguaLoop home">
      <span className="brand-mark">
        <LoopIcon size={29} strokeWidth={2.1} aria-hidden="true" />
      </span>
      <span>
        lingua<span className="brand-weight">loop</span>
      </span>
    </Link>
  );
}
