'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSignIn } from '@clerk/nextjs';
import { createAuthProof } from '@bsv/auth';
import { useWallet } from '@/components/auth/WalletProvider';
import { AUTH_PROTOCOL, LOGIN_ACTION } from '@/lib/walletAuth';

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
export const WALLET_FAILED_MESSAGE = "Couldn't verify wallet. Please try again.";

/** The faucet's auth public key, which the wallet signs its proof towards. */
export async function fetchServerKey(): Promise<string> {
  const res = await fetch('/api/wallet-auth/server-key');
  if (!res.ok) throw new Error(`server-key ${res.status}`);
  const { publicKey } = (await res.json()) as { publicKey: string };
  return publicKey;
}

export function walletErrorMessage(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  return /cancel|reject|denied/i.test(message)
    ? WALLET_CANCELLED_MESSAGE
    : WALLET_FAILED_MESSAGE;
}

/**
 * Signs a proof with the user's wallet, exchanges it at the login route for a
 * Clerk sign-in ticket, and starts an ordinary Clerk session from it.
 */
export function useWalletSignIn({ redirectTo }: { redirectTo: string }) {
  const wallet = useWallet();
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
    if (!isLoaded || !signIn) return;
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
      const serverKey = await fetchServerKey();
      // Ask for the identity key on its own first. This is where a wallet
      // that is closed or unapproved stalls, and checking afterwards means a
      // wallet that answers after the timeout is not then asked to sign.
      await wallet.getPublicKey({ identityKey: true });
      if (abandoned()) return;
      const proof = await createAuthProof({
        wallet,
        counterparty: serverKey,
        action: LOGIN_ACTION,
        protocol: AUTH_PROTOCOL
      });
      if (abandoned()) return;
      setPhase('verifying');

      const res = await fetch('/api/wallet-auth/login', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ proof })
      });
      if (!res.ok) throw new Error(`wallet-login ${res.status}`);
      const { ticket } = (await res.json()) as { ticket: string };
      if (abandoned()) return;

      const result = await signIn.create({ strategy: 'ticket', ticket });
      if (result.status !== 'complete' || !result.createdSessionId) {
        throw new Error(`ticket sign-in ended as ${result.status}`);
      }
      await setActive({ session: result.createdSessionId });
      if (abandoned()) return;

      router.push(redirectTo);
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
