import Link from 'next/link';
import {
  Home,
  Package2,
  PanelLeft,
  Settings,
  Wallet,
  List,
  Navigation,
  User2,
  Users2,
  Shield
} from 'lucide-react';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator
} from '@/components/ui/breadcrumb';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip';
import { Analytics } from '@vercel/analytics/react';
import { User } from './user';
import { BsvLogo } from '@/components/icons';
import Providers from './providers';
import { NavItem } from './nav-item';
import { SearchInput } from './search';
import { ThemeToggle } from './theme-toggle';

import DbBreadcrumb from '@/components/ui/DbBreadcrumb';
import { fetchUser } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default function DashboardLayout({
  children
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      <main className="flex min-h-screen w-full flex-col bg-muted/40">
        <DesktopNav />
        <div className="flex flex-col sm:gap-4 sm:py-4 sm:pl-14">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-4 border-b bg-background px-4 sm:static sm:h-auto sm:border-0 sm:bg-transparent sm:px-6">
            <MobileNav />
            <DashboardBreadcrumb />
            <SearchInput />
            <ThemeToggle />
            <User />
          </header>
          <main className="grid flex-1 items-start gap-2 p-4 sm:px-6 sm:py-0 md:gap-4 bg-muted/40">
            {children}
          </main>
        </div>
        <Analytics />
      </main>
    </Providers>
  );
}

async function DesktopNav() {
  const user = await fetchUser();
  return (
    <aside className="fixed inset-y-0 left-0 z-10 hidden w-14 flex-col border-r bg-background sm:flex">
      <nav className="flex flex-col items-center gap-4 px-2 sm:py-5">
        <Link
          href="/dashboard"
          className="group flex h-9 w-9 shrink-0 items-center justify-center gap-2 rounded-full text-lg font-semibold text-primary-foreground md:h-8 md:w-8 md:text-base"
        >
          <BsvLogo className="h-15 w-15 transition-all group-hover:scale-110" />
          <span className="sr-only">Acme Inc</span>
        </Link>

        <NavItem href="/dashboard" label="Dashboard">
          <Home className="h-5 w-5" />
        </NavItem>

        <NavItem href="/requests" label="Requests">
          <List className="h-5 w-5" />
        </NavItem>
        {user?.role === 'admin' && (
          <>
            <NavItem href="/users" label="Users">
              <Users2 className="h-5 w-5" />
            </NavItem>

            <NavItem href="/admin" label="Admin">
              <Shield className="h-5 w-5" />
            </NavItem>
          </>
        )}

        {/* <NavItem href="#" label="Analytics">
          <LineChart className="h-5 w-5" />
        </NavItem> */}
      </nav>
      <nav className="mt-auto flex flex-col items-center gap-4 px-2 sm:py-5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Link
              href="/settings"
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:text-foreground md:h-8 md:w-8"
            >
              <Settings className="h-5 w-5" />
              <span className="sr-only">Settings</span>
            </Link>
          </TooltipTrigger>
          <TooltipContent side="right">Settings</TooltipContent>
        </Tooltip>
      </nav>
    </aside>
  );
}

async function MobileNav() {
  const user = await fetchUser();
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button size="icon" variant="outline" className="sm:hidden">
          <PanelLeft className="h-5 w-5" />
          <span className="sr-only">Toggle Menu</span>
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="sm:max-w-xs">
        <nav className="grid gap-6 text-lg font-medium">
          <Link
            href="#"
            className="group flex h-10 w-10 shrink-0 items-center justify-center gap-2 rounded-full bg-primary text-lg font-semibold text-primary-foreground md:text-base"
          >
            <Package2 className="h-5 w-5 transition-all group-hover:scale-110" />
            <span className="sr-only">Vercel</span>
          </Link>
          <Link
            href="/dashboard"
            className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
          >
            <Home className="h-5 w-5" />
            Dashboard
          </Link>
          <Link
            href="/requests"
            className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
          >
            <List className="h-5 w-5" />
            Requests
          </Link>
          {user?.role === 'admin' && (
            <>
              <Link
                href="/users"
                className="flex items-center gap-4 px-2.5 text-foreground"
              >
                <Users2 className="h-5 w-5" />
                Users
              </Link>

              <Link
                href="/admin"
                className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
              >
                <Shield className="h-5 w-5" />
                Admin
              </Link>
            </>
          )}
          <Link
            href="/settings"
            className="flex items-center gap-4 px-2.5 text-muted-foreground hover:text-foreground"
          >
            <Settings className="h-5 w-5" />
            Settings
          </Link>
        </nav>
      </SheetContent>
    </Sheet>
  );
}

function DashboardBreadcrumb() {
  return (
    <div>
      <DbBreadcrumb />
    </div>
  );
}
