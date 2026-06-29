import { SignIn } from '@clerk/nextjs';
import { ThemeToggle } from '../../(dashboard)/theme-toggle';

export default function Page() {
  return (
    <div className="relative flex min-h-screen flex-col bg-background p-6">
      <div className="absolute right-6 top-6 z-10">
        <ThemeToggle />
      </div>
      <div className="flex flex-1 flex-col items-center justify-center">
        <SignIn
          fallbackRedirectUrl="/dashboard"
          appearance={{
            variables: {
              colorPrimary: '#1B1EA9',
              borderRadius: '0.75rem',
              fontFamily: 'var(--font-noto-sans), sans-serif'
            },
            elements: {
              rootBox: 'flex w-full justify-center',
              card: 'rounded-[20px] border border-border shadow-soft',
              logoImage: { borderRadius: '14px' },
              headerTitle: {
                fontFamily: "'Chillax', sans-serif",
                fontSize: '24px',
                fontWeight: 600
              },
              formButtonPrimary: 'rounded-full text-[15px] normal-case'
            }
          }}
        />
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
