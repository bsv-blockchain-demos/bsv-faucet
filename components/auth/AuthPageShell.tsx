import type { ReactNode } from 'react';

/** The page around AuthCard when wallet sign-in is enabled. */
export function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background p-6">
      <div className="flex flex-1 flex-col items-center justify-center">
        {children}
      </div>
      <footer className="pt-6 text-center text-[13px] text-muted-foreground">
        © {new Date().getFullYear()}{' '}
        <a
          href="https://bsvblockchain.org"
          target="_blank"
          rel="noopener noreferrer"
          className="underline-offset-2 transition-colors hover:text-foreground hover:underline"
        >
          BSV Blockchain org
        </a>
        . All rights reserved.
      </footer>
    </div>
  );
}
