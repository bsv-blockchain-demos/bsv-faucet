import type { ReactNode } from 'react';

/** The page around AuthCard when wallet sign-in is enabled. */
export function AuthPageShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background p-6">
      {/* Top-anchored rather than centred: the card's height follows the
          active tab, so centring would move the tabs under the cursor. */}
      <div className="flex flex-1 flex-col items-center justify-start pt-[10vh]">
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
