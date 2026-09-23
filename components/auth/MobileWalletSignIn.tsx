'use client';

import { useCallback, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useSignIn } from '@clerk/nextjs';
import { useWalletRelayClient } from '@bsv/wallet-relay/react';
import { AlertTriangle, ArrowLeft, Smartphone } from 'lucide-react';
import { AuthCard } from '@/components/auth/AuthCard';
import { WalletSigningPanel } from '@/components/auth/WalletSigningPanel';
import {
  WALLET_CANCELLED_MESSAGE,
  WALLET_TIMEOUT_MESSAGE,
  useWalletSignIn
} from '@/hooks/useWalletSignIn';
import { RELAY_API_PATH, backToAuthPath } from '@/lib/walletRelay';

type Mode = 'sign-in' | 'sign-up';

const COPY: Record<Mode, { heading: string; back: string }> = {
  'sign-in': { heading: 'Sign in with your phone', back: 'Back to sign-in' },
  'sign-up': { heading: 'Sign up with your phone', back: 'Back to sign-up' }
};

const RELAY_UNREACHABLE_MESSAGE =
  "Couldn't reach the pairing service. Try again in a moment.";

/**
 * The desktop hook's copy talks about a wallet on this computer. On this
 * page the wallet is a phone, so the two messages that name the wallet are
 * reworded; the rest pass through unchanged.
 */
function phoneErrorMessage(message: string): string {
  if (message === WALLET_TIMEOUT_MESSAGE) {
    return "Your phone didn't answer in time. Try again.";
  }
  if (message === WALLET_CANCELLED_MESSAGE) {
    return 'Sign-in cancelled on your phone. Try again or use email.';
  }
  return message;
}

/**
 * The QR page's card. Creates a pairing session with the relay, shows its QR
 * code, and once the phone connects runs the same sign-in flow as the desktop
 * button, with the relay's wallet proxy standing in for the local wallet.
 */
export function MobileWalletSignIn({
  mode,
  redirectTo
}: {
  mode: Mode;
  /** Already checked to be same-origin, on the server. */
  redirectTo: string;
}) {
  const { isLoaded } = useSignIn();
  // autoCreate off: the session is created below, once, and cancelled on
  // unmount so a phone left connected is told the session is over.
  const relay = useWalletRelayClient({
    apiUrl: RELAY_API_PATH,
    autoCreate: false
  });
  const { session, wallet, createSession, cancelSession } = relay;
  const walletSignIn = useWalletSignIn({ redirectTo, wallet });

  const createdRef = useRef(false);
  useEffect(() => {
    if (createdRef.current) return;
    createdRef.current = true;
    void createSession();
  }, [createSession]);
  useEffect(() => () => cancelSession(), [cancelSession]);

  // One sign-in per connection. The phone connecting is the user's consent
  // to start; the phone itself still asks them to approve the signature.
  const startedForRef = useRef<string | null>(null);
  const { start, phase, error: signInError, isReady } = walletSignIn;
  useEffect(() => {
    if (!isReady || session?.status !== 'connected' || !wallet) return;
    if (startedForRef.current === session.sessionId) return;
    startedForRef.current = session.sessionId;
    void start();
  }, [isReady, session?.status, session?.sessionId, wallet, start]);

  const retry = useCallback(() => {
    if (session?.status === 'connected' && wallet) {
      startedForRef.current = null;
      void start();
      return;
    }
    void createSession();
  }, [session?.status, wallet, start, createSession]);

  const { heading, back } = COPY[mode];

  if (phase === 'verifying') {
    return (
      <AuthCard>
        <WalletSigningPanel />
      </AuthCard>
    );
  }

  const error = signInError
    ? phoneErrorMessage(signInError)
    : relay.error
      ? RELAY_UNREACHABLE_MESSAGE
      : null;
  const status = session?.status ?? 'pending';
  const connected = status === 'connected';
  const stale = status === 'expired' || status === 'disconnected';

  return (
    <AuthCard
      heading={heading}
      subtitle="Open BSV Browser on your phone, tap Scan QR and point it at this code."
    >
      <div className="flex flex-col items-center">
        {/* Always white, in dark mode too: a QR code on a dark surface does
            not scan. The frame's own border keeps it from floating. */}
        <div className="relative flex h-60 w-60 items-center justify-center overflow-hidden rounded-2xl border border-border bg-white p-3">
          {connected ? (
            <div
              role="status"
              aria-live="polite"
              className="flex flex-col items-center gap-3 text-center text-neutral-800"
            >
              <span
                aria-hidden
                className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 motion-safe:animate-pulse"
              >
                <Smartphone className="h-[22px] w-[22px]" />
              </span>
              <p className="text-[15px] font-medium">Approve on your phone</p>
            </div>
          ) : session?.qrDataUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={session.qrDataUrl}
                alt="QR code to scan with BSV Browser"
                className={stale ? 'h-full w-full opacity-15' : 'h-full w-full'}
              />
              {stale && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center text-neutral-800">
                  <p className="text-[15px] font-medium">
                    {status === 'expired'
                      ? 'This code has expired'
                      : 'Your phone disconnected'}
                  </p>
                  <button
                    type="button"
                    onClick={() => void createSession()}
                    className="rounded-full border-[1.5px] border-neutral-800 px-4 py-1.5 text-[13px] font-medium text-neutral-800 transition-colors hover:bg-neutral-100"
                  >
                    Show a new code
                  </button>
                </div>
              )}
            </>
          ) : (
            <div
              aria-hidden
              className={
                error
                  ? 'h-full w-full rounded-xl bg-neutral-100'
                  : 'h-full w-full rounded-xl bg-neutral-100 motion-safe:animate-pulse'
              }
            />
          )}
        </div>

        <div className="mt-4 flex min-h-[44px] w-full flex-col justify-center">
          {error ? (
            <div
              role="alert"
              className="flex flex-col gap-2 rounded-2xl bg-negative/10 px-4 py-3"
            >
              <p className="flex items-center gap-2 text-sm font-medium leading-5 text-negative">
                <AlertTriangle
                  aria-hidden
                  className="h-[18px] w-[18px] shrink-0"
                />
                {error}
              </p>
              <button
                type="button"
                onClick={retry}
                className="self-start text-[13px] font-medium text-foreground underline-offset-2 hover:underline"
              >
                Try again
              </button>
            </div>
          ) : (
            <p
              aria-live="polite"
              className="flex items-center justify-center gap-2 px-1 text-[13px] text-muted-foreground"
            >
              <span
                aria-hidden
                className="h-2 w-2 rounded-full bg-muted-foreground/50 motion-safe:animate-pulse"
              />
              {connected
                ? 'Phone connected. Waiting for your approval…'
                : stale
                  ? 'Codes last two minutes.'
                  : session
                    ? 'Waiting for the scan…'
                    : 'Getting a code ready…'}
            </p>
          )}
        </div>

        <Link
          href={backToAuthPath(mode)}
          className="mt-6 flex items-center gap-1.5 text-[13px] font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
        >
          <ArrowLeft aria-hidden className="h-4 w-4" />
          {back}
        </Link>
      </div>
    </AuthCard>
  );
}
