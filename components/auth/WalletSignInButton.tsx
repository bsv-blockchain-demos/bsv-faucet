'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, ArrowRight, Monitor } from 'lucide-react';
import { useWallet } from '@/components/auth/WalletProvider';
import type { WalletDetection } from '@/components/auth/WalletStatusNote';
import type { WalletSignInPhase } from '@/hooks/useWalletSignIn';

const DETECTION_TIMEOUT_MS = 2_000;

/**
 * Probes for a wallet on mount and again on every window focus, so opening
 * or closing BSV Desktop while the page is open is picked up. It re-probes
 * even when a wallet was already detected, because the case to catch is the
 * wallet being closed while the page stays open.
 */
function useWalletDetection(onChange?: (state: WalletDetection) => void) {
  const wallet = useWallet();
  const [detection, setDetection] = useState<WalletDetection>('checking');
  const probeRef = useRef(0);

  const probe = useCallback(async () => {
    const run = ++probeRef.current;
    setDetection('checking');
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      await Promise.race([
        wallet.getVersion(),
        new Promise((_, reject) => {
          timer = setTimeout(
            () => reject(new Error('timeout')),
            DETECTION_TIMEOUT_MS
          );
        })
      ]);
      if (run === probeRef.current) setDetection('detected');
    } catch {
      if (run === probeRef.current) setDetection('not-detected');
    } finally {
      clearTimeout(timer);
    }
  }, [wallet]);

  useEffect(() => {
    void probe();
    const onFocus = () => void probe();
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      probeRef.current++;
    };
  }, [probe]);

  useEffect(() => {
    onChange?.(detection);
  }, [detection, onChange]);
}

/**
 * "Continue with BSV wallet". Stays enabled when no wallet is detected,
 * because detection can give a false negative (an untrusted local
 * certificate, for example) and the click is the real test. Disabled only
 * while a sign-in is in flight or Clerk has not loaded.
 */
export function WalletSignInButton({
  mode,
  phase,
  error,
  isReady,
  onClick,
  onDetectionChange
}: {
  mode: 'sign-in' | 'sign-up';
  phase: WalletSignInPhase;
  error: string | null;
  isReady: boolean;
  onClick: () => void;
  onDetectionChange?: (state: WalletDetection) => void;
}) {
  useWalletDetection(onDetectionChange);
  const busy = phase !== 'idle';

  const label = busy
    ? 'Approve in your wallet…'
    : mode === 'sign-up'
      ? 'Sign up with BSV wallet'
      : 'Continue with BSV wallet';

  return (
    <div className="flex w-full flex-col gap-2.5">
      {/* In progress: 75% opacity and a label swap, never a spinner. */}
      <button
        type="button"
        onClick={onClick}
        disabled={busy || !isReady}
        aria-busy={busy}
        className="flex w-full items-center gap-3.5 rounded-2xl border-[1.5px] border-primary bg-card px-4 py-3.5 text-left transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card disabled:cursor-progress disabled:opacity-75 disabled:hover:bg-card"
      >
        <span
          aria-hidden
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-foreground"
        >
          <Monitor className="h-5 w-5" />
        </span>
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[15px] font-medium">{label}</span>
          <span className="text-[13px] text-muted-foreground">
            Use a wallet on this computer
          </span>
        </span>
        <ArrowRight
          aria-hidden
          className="h-[18px] w-[18px] shrink-0 text-muted-foreground"
        />
      </button>

      {error && (
        <p role="alert" className="flex items-start gap-2 text-sm text-negative">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span>{error}</span>
        </p>
      )}

      {mode === 'sign-up' && (
        <p className="text-[13px] text-muted-foreground">
          No email needed. Your wallet&apos;s identity key is your account.
        </p>
      )}
    </div>
  );
}
