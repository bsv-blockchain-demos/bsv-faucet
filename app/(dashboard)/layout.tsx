import Link from 'next/link';
import { Home, List, Settings, Shield, Users2 } from 'lucide-react';

import { Analytics } from '@vercel/analytics/react';
import { User } from './user';
import { BsvLogo } from '@/components/icons';
import Providers from './providers';
import { NavItem } from './nav-item';
import { ThemeToggle } from './theme-toggle';
import { TopbarTitle } from './topbar-title';
import { fetchUser } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  const user = await fetchUser();
  const isAdmin = user?.role === 'admin';

  return (
    <Providers>
      <div className="grid min-h-screen grid-cols-[78px_1fr] bg-background max-[860px]:grid-cols-[60px_1fr] max-[560px]:grid-cols-1">
        {/* Sidebar rail */}
        <aside className="sticky top-0 z-10 flex h-screen flex-col items-center gap-[26px] border-r bg-card py-[18px] max-[560px]:fixed max-[560px]:inset-x-0 max-[560px]:bottom-0 max-[560px]:top-auto max-[560px]:z-20 max-[560px]:h-auto max-[560px]:flex-row max-[560px]:justify-around max-[560px]:gap-1 max-[560px]:border-r-0 max-[560px]:border-t max-[560px]:py-2">
          <Link href="/dashboard" className="shrink-0 max-[560px]:hidden">
            <BsvLogo className="h-11 w-11 rounded-[12px]" />
            <span className="sr-only">BSV Faucet</span>
          </Link>

          <nav className="flex flex-1 flex-col items-center gap-2 max-[560px]:flex-none max-[560px]:flex-row">
            <NavItem href="/dashboard" label="Dashboard">
              <Home className="h-[22px] w-[22px]" />
            </NavItem>
            <NavItem href="/requests" label="Requests">
              <List className="h-[22px] w-[22px]" />
            </NavItem>
            {isAdmin && (
              <>
                <NavItem href="/users" label="Users">
                  <Users2 className="h-[22px] w-[22px]" />
                </NavItem>
                <NavItem href="/admin" label="Admin">
                  <Shield className="h-[22px] w-[22px]" />
                </NavItem>
              </>
            )}
          </nav>

          <NavItem href="/settings" label="Settings">
            <Settings className="h-[22px] w-[22px]" />
          </NavItem>
        </aside>

        {/* Main column */}
        <div className="flex min-w-0 flex-col">
          <header className="sticky top-0 z-[5] flex items-center gap-5 border-b bg-[var(--topbar)] px-7 py-[14px] backdrop-blur-[10px] max-[860px]:px-4">
            <TopbarTitle />
            <div className="flex-1" />
            <ThemeToggle />
            <User />
          </header>

          <main className="screen-fade mx-auto w-full max-w-[1240px] flex-1 p-7 max-[860px]:p-[18px] max-[560px]:pb-[84px]">
            {children}
          </main>
        </div>
      </div>
      <Analytics />
    </Providers>
  );
}
