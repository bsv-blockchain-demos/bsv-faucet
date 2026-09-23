'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSignIn } from '@clerk/nextjs';
import type { ProofSignerWallet } from '@bsv/auth';
import { useOptionalWallet } from '@/components/auth/WalletProvider';
import { signInWithWallet } from '@/lib/walletSignInFlow';

export { fetchServerKey } from '@/lib/walletSignInFlow';

/**
 * idle: nothing in flight.
 * prompting: waiting for the user to approve in their wallet.
 * verifying: the proof is signed; the server is checking it and Clerk is
 * starting the session. Stays set after success until the page navigates.
 */
export type WalletSignInPhase = 'idle' | 'prompting' | 'verifying';

const PROMPT_TIMEOUT_MS = 60_000;

export const WALLET_TIMEOUT_MESSAGE =
  'Could not connect to your wallet. Make sure your BSV wallet is running.';
export const WALLET_CANCELLED_MESSAGE =
  'Sign-in cancelled. Try again or use email.';
export const WALLET_FAILED_MESSAGE =
  "Couldn't verify wallet. Please try again.";

export function walletErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/cancel|reject|denied/i.test(message)) return WALLET_CANCELLED_MESSAGE;
  // The SDK throws this when no wallet answers on any substrate. Nothing was
  // verified, so "Couldn't verify wallet" would point the user the wrong way.
  if (/no wallet available|communication substrate/i.test(message)) {
    return WALLET_TIMEOUT_MESSAGE;
  }
  return WALLET_FAILED_MESSAGE;
}

/**
 * Runs the wallet sign-in flow (lib/walletSignInFlow.ts) with phases, a
 * prompt timeout and error copy, then navigates to redirectTo.
 *
 * The wallet comes from the surrounding WalletProvider by default (a wallet
 * on this computer). Pass `wallet` to sign in with another one, such as the
 * relay's proxy for a phone paired by QR code; it is read when start() runs,
 * so it may be null until the phone connects.
 */
export function useWalletSignIn({
  redirectTo,
  wallet: walletOverride
}: {
  redirectTo: string;
  wallet?: ProofSignerWallet | null;
}) {
  const contextWallet = useOptionalWallet();
  const wallet = walletOverride ?? contextWallet;
  const router = useRouter();
  const { isLoaded, signIn, setActive } = useSignIn();

  const [phase, setPhase] = useState<WalletSignInPhase>('idle');
  const [error, setError] = useState<string | null>(null);

  // Each attempt gets a number. The wallet call cannot be cancelled, so when
  // the timeout fires the attempt is abandoned by bumping the number, and
  // anything the old attempt does afterwards, including a late success, is
  // ignored rather than redirecting the user.
  const attemptRef = useRef(0);
  useEffect(() => () => void attemptRef.current++, []);

  const start = useCallback(async () => {
    if (!isLoaded || !signIn || !wallet) return;
    const attempt = ++attemptRef.current;
    const abandoned = () => attemptRef.current !== attempt;

    setError(null);
    setPhase('prompting');

    const timeout = setTimeout(() => {
      if (abandoned()) return;
      attemptRef.current++;
      setPhase('idle');
      setError(WALLET_TIMEOUT_MESSAGE);
    }, PROMPT_TIMEOUT_MS);

    try {
      const outcome = await signInWithWallet({
        wallet,
        clerk: { signIn, setActive },
        abandoned,
        onVerifying: () => setPhase('verifying')
      });
      if (outcome === 'done') router.push(redirectTo);
    } catch (err) {
      console.error('[wallet-login] flow failed:', err);
      if (abandoned()) return;
      setPhase('idle');
      setError(walletErrorMessage(err));
    } finally {
      clearTimeout(timeout);
    }
  }, [isLoaded, signIn, setActive, wallet, router, redirectTo]);

  return { phase, error, start, isReady: isLoaded };
}
