import Link from 'next/link';
import { ArrowRight, Smartphone } from 'lucide-react';
import { mobileSignInHref } from '@/lib/walletRelay';

/**
 * "Connect with phone via QR code": the second option card on the wallet
 * tab, for a computer without a wallet. A link, not a button, because it
 * opens the QR page. Same layout as WalletSignInButton, with a neutral
 * border and tile so the wallet on this computer stays the primary option.
 */
export function WalletRelayQrButton({
  mode,
  redirectTo
}: {
  mode: 'sign-in' | 'sign-up';
  redirectTo: string;
}) {
  const label =
    mode === 'sign-up'
      ? 'Sign up with phone via QR code'
      : 'Connect with phone via QR code';

  return (
    <Link
      href={mobileSignInHref(mode, redirectTo)}
      className="flex w-full items-center gap-3.5 rounded-2xl border-[1.5px] border-border bg-card px-4 py-3.5 text-left transition-colors hover:bg-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-card"
    >
      <span
        aria-hidden
        className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-muted text-muted-foreground"
      >
        <Smartphone className="h-5 w-5" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-[15px] font-medium">{label}</span>
        <span className="text-[13px] text-muted-foreground">
          Use a wallet on your phone
        </span>
      </span>
      <ArrowRight
        aria-hidden
        className="h-[18px] w-[18px] shrink-0 text-muted-foreground"
      />
    </Link>
  );
}
