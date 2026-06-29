import { SignUp } from '@clerk/nextjs';
import Image from 'next/image';

export default function Page() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-6">
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
          Create your BSV Faucet account
        </h1>
      </div>
      <SignUp
        forceRedirectUrl="/api/sign-up"
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
  );
}
