'use client';

import { useCallback, useEffect, useState } from 'react';
import { SignIn, SignUp, useSignIn } from '@clerk/nextjs';
import { Info } from 'lucide-react';
import { AuthCard } from '@/components/auth/AuthCard';
import { AuthMethodTabs, type AuthMethod } from '@/components/auth/AuthMethodTabs';
import { embeddedClerkAppearance } from '@/components/auth/clerkAppearance';
import { WalletProvider } from '@/components/auth/WalletProvider';
import { WalletRelayQrButton } from '@/components/auth/WalletRelayQrButton';
import { WalletSignInButton } from '@/components/auth/WalletSignInButton';
import { WalletSigningPanel } from '@/components/auth/WalletSigningPanel';
import {
  WalletFeedback,
  type WalletDetection
} from '@/components/auth/WalletStatusNote';
import { useWalletSignIn } from '@/hooks/useWalletSignIn';
import { WALLET_RELAY_ENABLED } from '@/lib/walletRelay';

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

// Pinned to the wallet tab's height in its usual state (no wallet detected),
// so the card keeps its size when switching tabs. In production the wallet
// tab is the taller of the two, as Clerk asks for an email address only. The
// development-mode sign-in form is a few pixels taller because of its extra
// band, which only shows locally. Remeasure if either tab's content changes.
// With QR sign-in on, the wallet tab also holds the phone card and its gap.
const BODY_MIN_HEIGHT: Record<Mode, string> = WALLET_RELAY_ENABLED
  ? {
      'sign-in': 'min-h-[302px]',
      'sign-up': 'min-h-[334px]'
    }
  : {
      'sign-in': 'min-h-[215px]',
      'sign-up': 'min-h-[247px]'
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
            // One email flow for new and existing users: an unknown address
            // carries on into sign-up instead of stopping at "Couldn't find
            // your account". New accounts leave through /api/sign-up, like
            // those from the sign-up page, so their User row is written.
            <SignIn
              withSignUp
              fallbackRedirectUrl="/dashboard"
              signUpForceRedirectUrl="/api/sign-up"
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
          // Hierarchy: the action first (on sign-up after one quiet line of
          // context), feedback on that action right under it, and a footnote
          // set apart below a hairline, like Clerk's footer on the email tab.
          <div className="flex flex-col">
            {mode === 'sign-up' && (
              <p className="mb-3 text-center text-[13px] leading-5 text-muted-foreground">
                <span className="font-medium text-foreground">
                  No email needed.
                </span>{' '}
                Your wallet&apos;s identity key is your account.
              </p>
            )}
            <WalletSignInButton
              mode={mode}
              phase={walletSignIn.phase}
              isReady={walletSignIn.isReady}
              onClick={walletSignIn.start}
              onDetectionChange={setDetection}
            />
            {WALLET_RELAY_ENABLED && (
              <div className="mt-3">
                <WalletRelayQrButton mode={mode} redirectTo={redirectTo} />
              </div>
            )}
            <div className="mt-3 flex flex-col">
              <WalletFeedback
                detection={detection}
                error={walletSignIn.error}
              />
            </div>
            <p className="mt-6 flex items-start gap-2 border-t border-border pt-4 text-[13px] leading-5 text-muted-foreground">
              <Info
                aria-hidden
                className="mt-0.5 h-4 w-4 shrink-0"
              />
              <span>Wallet and email sign-ins are separate faucet accounts.</span>
            </p>
          </div>
        }
      />
    </AuthCard>
  );
}
