import type { ReactNode } from 'react';
import { BsvLogo } from '@/components/icons';
import { ThemeToggle } from '@/app/(dashboard)/theme-toggle';

/**
 * The single card the sign-in and sign-up pages share: logo, heading, theme
 * toggle, and a body holding the method tabs or the signing panel. The Clerk
 * widget sits inside it with its own card chrome removed.
 */
export function AuthCard({
  heading,
  subtitle,
  children
}: {
  heading?: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="relative w-full max-w-[440px] rounded-[20px] border border-border bg-card px-6 pb-7 pt-8 shadow-soft sm:px-8">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="flex flex-col items-center gap-2 text-center">
        <BsvLogo className="h-14 w-14 rounded-[14px]" />
        {heading && (
          <h1 className="mt-2 font-display text-[24px] font-semibold leading-tight">
            {heading}
          </h1>
        )}
        {subtitle && (
          <p className="text-[15px] text-muted-foreground">{subtitle}</p>
        )}
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
