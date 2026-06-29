'use client';

import { usePathname } from 'next/navigation';

const TITLES: Record<string, string> = {
  '/': 'Dashboard',
  '/dashboard': 'Dashboard',
  '/requests': 'Requests',
  '/users': 'Users',
  '/customers': 'Users',
  '/admin': 'Admin',
  '/settings': 'Account settings',
  '/wallet': 'Wallet',
  '/transactions': 'Transactions'
};

export function TopbarTitle() {
  const pathname = usePathname();
  const seg = pathname.split('/').filter(Boolean)[0];
  const title =
    TITLES[pathname] ??
    (seg ? seg.charAt(0).toUpperCase() + seg.slice(1) : 'Dashboard');

  return <div className="font-display text-[18px] font-semibold">{title}</div>;
}
