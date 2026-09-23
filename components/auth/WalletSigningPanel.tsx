import { Wallet } from 'lucide-react';

/**
 * Replaces the card body while a wallet sign-in is being verified and the
 * Clerk session starts, so the Clerk widget does not flash as the session
 * activates. Also the loading state while Clerk loads (pass subtitle={null}).
 *
 * No spinner, per the brand system: a slow pulse on a thin-line icon, which
 * stops for anyone who prefers reduced motion.
 */
export function WalletSigningPanel({
  message = 'Signing you in…',
  subtitle = 'Verifying your identity. This can take a few seconds.'
}: {
  message?: string;
  subtitle?: string | null;
}) {
  return (
    <div
      role="status"
      aria-live="polite"
      className="flex flex-col items-center gap-3.5 px-2 py-12 text-center"
    >
      <span
        aria-hidden
        className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-accent-foreground motion-safe:animate-pulse"
      >
        <Wallet className="h-[22px] w-[22px]" />
      </span>
      <p className="text-base font-medium">{message}</p>
      {subtitle && (
        <p className="max-w-[280px] text-[13px] text-muted-foreground">
          {subtitle}
        </p>
      )}
    </div>
  );
}
