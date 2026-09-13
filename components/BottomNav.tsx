'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Play, BookOpen, UserRound } from 'lucide-react';
const links = [
  { href: '/feed', label: 'Feed', icon: Play },
  { href: '/learn', label: 'Learn', icon: BookOpen },
  { href: '/profile', label: 'You', icon: UserRound },
];
export function BottomNav({ desktop = false }: { desktop?: boolean }) {
  const pathname = usePathname();
  return (
    <nav
      className={desktop ? 'desktop-nav' : 'bottom-nav'}
      aria-label={desktop ? 'Main navigation' : 'Mobile navigation'}
    >
      {links.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={pathname === href ? 'nav-link active' : 'nav-link'}
          aria-current={pathname === href ? 'page' : undefined}
        >
          <Icon
            size={20}
            strokeWidth={1.8}
            fill={pathname === href && label === 'Feed' ? 'currentColor' : 'none'}
            aria-hidden="true"
          />
          <span>{label}</span>
        </Link>
      ))}
    </nav>
  );
}
