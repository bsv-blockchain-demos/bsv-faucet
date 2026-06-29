import { SignIn } from '@clerk/nextjs';
import Image from 'next/image';

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col bg-background p-6">
      <div className="flex flex-1 flex-col items-center justify-center gap-6">
        <div className="flex flex-col items-center gap-4">
          <Image
            src="/bsv-blockchain-logo.png"
            alt="BSV Blockchain"
            width={64}
            height={64}
            className="rounded-2xl"
            priority
          />
          <h1 className="font-display text-2xl font-semibold">
            Sign in to BSV Faucet
          </h1>
        </div>
        <SignIn
          appearance={{
            variables: {
              colorPrimary: '#1B1EA9',
              borderRadius: '0.75rem',
              fontFamily: 'var(--font-noto-sans), sans-serif'
            },
            elements: {
              rootBox: 'flex w-full justify-center',
              card: 'rounded-[20px] border border-border shadow-soft',
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
