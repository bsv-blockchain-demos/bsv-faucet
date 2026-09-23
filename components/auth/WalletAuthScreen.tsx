'use client';

import { useCallback, useEffect, useState } from 'react';
import { SignIn, SignUp, useSignIn } from '@clerk/nextjs';
import { AuthCard } from '@/components/auth/AuthCard';
import { AuthMethodTabs, type AuthMethod } from '@/components/auth/AuthMethodTabs';
import { embeddedClerkAppearance } from '@/components/auth/clerkAppearance';
import { WalletProvider } from '@/components/auth/WalletProvider';
import { WalletSignInButton } from '@/components/auth/WalletSignInButton';
import { WalletSigningPanel } from '@/components/auth/WalletSigningPanel';
import {
  WalletStatusNote,
  type WalletDetection
} from '@/components/auth/WalletStatusNote';
import { useWalletSignIn } from '@/hooks/useWalletSignIn';

type Mode = 'sign-in' | 'sign-up';

const COPY: Record<Mode, { heading: string; subtitle: string }> = {
  'sign-in': {
    heading: 'Sign in to BSV Faucet',
    subtitle: 'Pick a sign-in method to continue.'
  },
  'sign-up': {
    heading: 'Create your account',
    subtitle: 'Pick a sign-up method to continue.'
  }
};

// Pinned to the email tab's measured height on each page (the Clerk widget
// on development keys, including its development-mode band), so the card
// keeps its size when switching tabs. The shorter wallet tab top-aligns and
// leaves trailing space. Remeasure if the Clerk instance's fields change.
const BODY_MIN_HEIGHT: Record<Mode, string> = {
  'sign-in': 'min-h-[222px]',
  'sign-up': 'min-h-[302px]'
};

// Remembers the last tab so a returning wallet user lands on the wallet tab.
const METHOD_STORAGE_KEY = 'bsv-faucet.auth-method';

/**
 * The sign-in and sign-up pages when wallet sign-in is enabled: one card
 * with Email and BSV Wallet tabs. The wallet flow is the same on both pages,
 * because the login route creates the account on first use.
 */
export function WalletAuthScreen(props: {
  mode: Mode;
  /** Already checked to be same-origin, on the server. */
  redirectTo: string;
  /** False on Clerk's sub-routes such as /sign-in/factor-one. */
  isBareRoute: boolean;
}) {
  return (
    <WalletProvider>
      <Screen {...props} />
    </WalletProvider>
  );
}

function Screen({
  mode,
  redirectTo,
  isBareRoute
}: {
  mode: Mode;
  redirectTo: string;
  isBareRoute: boolean;
}) {
  const { isLoaded } = useSignIn();
  const walletSignIn = useWalletSignIn({ redirectTo });
  const [method, setMethod] = useState<AuthMethod>('email');
  const [detection, setDetection] = useState<WalletDetection>('checking');

  // Only on the bare route: on a Clerk sub-route the email flow is mid-way
  // through (a verification code, say) and must stay on screen.
  useEffect(() => {
    if (!isBareRoute) return;
    try {
      if (localStorage.getItem(METHOD_STORAGE_KEY) === 'wallet') {
        setMethod('wallet');
      }
    } catch {
      // Storage can be unavailable, for example in some private modes.
    }
  }, [isBareRoute]);

  const chooseMethod = useCallback((next: AuthMethod) => {
    setMethod(next);
    try {
      localStorage.setItem(METHOD_STORAGE_KEY, next);
    } catch {
      // As above: remembering the tab is a nicety, not a requirement.
    }
  }, []);

  if (walletSignIn.phase === 'verifying') {
    return (
      <AuthCard>
        <WalletSigningPanel />
      </AuthCard>
    );
  }

  if (!isLoaded) {
    return (
      <AuthCard>
        <WalletSigningPanel message="Loading…" subtitle={null} />
      </AuthCard>
    );
  }

  const { heading, subtitle } = COPY[mode];

  return (
    <AuthCard heading={heading} subtitle={subtitle}>
      <AuthMethodTabs
        value={method}
        onChange={chooseMethod}
        bodyClassName={BODY_MIN_HEIGHT[mode]}
        email={
          mode === 'sign-in' ? (
            <SignIn
              fallbackRedirectUrl="/dashboard"
              appearance={embeddedClerkAppearance}
            />
          ) : (
            <SignUp
              forceRedirectUrl="/api/sign-up"
              appearance={embeddedClerkAppearance}
            />
          )
        }
        wallet={
          <div className="flex flex-col gap-4">
            <WalletSignInButton
              mode={mode}
              phase={walletSignIn.phase}
              error={walletSignIn.error}
              isReady={walletSignIn.isReady}
              onClick={walletSignIn.start}
              onDetectionChange={setDetection}
            />
            <WalletStatusNote detection={detection} />
            <p className="border-t border-border pt-4 text-center text-[13px] text-muted-foreground">
              A wallet sign-in uses a separate faucet account from any email
              account.
            </p>
          </div>
        }
      />
    </AuthCard>
  );
}
