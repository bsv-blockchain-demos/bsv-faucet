import 'server-only';

import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { auth } from '@clerk/nextjs/server';
import { safeRedirectPath } from '@/lib/walletAuth';

/**
 * Server-side setup for the sign-in and sign-up pages when wallet sign-in is
 * enabled: works out the same-origin redirect target, and sends an already
 * signed-in user straight on.
 *
 * The redirect only happens on the bare /sign-in or /sign-up. Clerk owns the
 * sub-routes (such as /sign-in/tasks, where it collects a session task like
 * choosing an organisation), and redirecting from those can loop between a
 * protected page and Clerk.
 */
export async function prepareAuthPage(
  segments: string[] | undefined,
  searchParams: Record<string, string | string[] | undefined>
): Promise<{ redirectTo: string; isBareRoute: boolean }> {
  const isBareRoute = !segments || segments.length === 0;

  const raw = searchParams.redirect_url;
  const requested = Array.isArray(raw) ? raw[0] : raw;
  const headerList = await headers();
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host');
  const proto =
    headerList.get('x-forwarded-proto') ??
    (host?.startsWith('localhost') ? 'http' : 'https');
  const redirectTo = safeRedirectPath(requested, `${proto}://${host}`);

  if (isBareRoute) {
    const { userId } = await auth();
    if (userId) redirect(redirectTo);
  }

  return { redirectTo, isBareRoute };
}
