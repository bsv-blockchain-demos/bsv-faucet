import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AuthCard } from '@/components/auth/AuthCard';
import { AuthPageShell } from '@/components/auth/AuthPageShell';
import { MobileWalletSignIn } from '@/components/auth/MobileWalletSignIn';
import { prepareAuthPage } from '@/lib/authPage';
import { WALLET_AUTH_ENABLED } from '@/lib/walletAuth';
import { WALLET_RELAY_ENABLED, backToAuthPath } from '@/lib/walletRelay';

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Phone wallet sign-in by QR code. Its own route outside /sign-in/* because
 * Clerk's path routing claims everything under /sign-in. Serves both the
 * sign-in and sign-up cards: the login route creates the account on first
 * use, so only the copy differs, chosen by ?mode=sign-up.
 */
export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const mode = params.mode === 'sign-up' ? 'sign-up' : 'sign-in';

  // The card that links here is hidden when the flag is off, but the URL
  // can still be typed, so say so instead of showing a code that never pairs.
  if (!WALLET_AUTH_ENABLED || !WALLET_RELAY_ENABLED) {
    return (
      <AuthPageShell>
        <AuthCard
          heading="QR sign-in isn't available"
          subtitle="Signing in with a phone is switched off here."
        >
          <Link
            href={backToAuthPath(mode)}
            className="flex items-center justify-center gap-1.5 text-[13px] font-medium text-muted-foreground underline-offset-2 transition-colors hover:text-foreground hover:underline"
          >
            <ArrowLeft aria-hidden className="h-4 w-4" />
            {mode === 'sign-up' ? 'Back to sign-up' : 'Back to sign-in'}
          </Link>
        </AuthCard>
      </AuthPageShell>
    );
  }

  const { redirectTo } = await prepareAuthPage(undefined, params);
  return (
    <AuthPageShell>
      <MobileWalletSignIn mode={mode} redirectTo={redirectTo} />
    </AuthPageShell>
  );
}
