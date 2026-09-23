// Shared by the browser, the pages and next.config.ts, so nothing in this file
// may be secret and it must not import anything server-only.

/**
 * 'true' shows the "Connect with phone via QR code" card and enables the
 * /sign-in-mobile page. Separate from NEXT_PUBLIC_WALLET_AUTH_ENABLED so QR
 * sign-in can be switched off without touching desktop wallet sign-in. Next
 * inlines it at build time in both bundles, so the server and the pages agree.
 */
export const WALLET_RELAY_ENABLED =
  process.env.NEXT_PUBLIC_WALLET_RELAY_ENABLED === 'true';

/**
 * The QR page. Outside /sign-in/* on purpose: Clerk's path routing claims
 * everything under /sign-in, so a page there would be swallowed by its
 * internal router instead of rendering.
 */
export const MOBILE_SIGN_IN_PATH = '/sign-in-mobile';

/**
 * Where the browser talks to the relay: a same-origin path that next.config.ts
 * rewrites to the relay service. Same-origin means no CORS, the relay's
 * address stays out of the client bundle, and a preview deployment behind
 * Vercel's protection works too, because only the faucet's own origin is ever
 * in a QR code. It ends in /api because the relay client appends /api to any
 * base that does not already end with it.
 */
export const RELAY_API_PATH = '/wallet-relay/api';

/**
 * The route the phone calls after scanning. The library fixes this path: the
 * QR carries the faucet's origin and the phone fetches `{origin}/api/session/
 * {topic}` over HTTPS to learn the relay's WebSocket address. The origin's TLS
 * certificate is what the phone trusts, so this route must be on the faucet's
 * own domain, not the relay's.
 */
export const PHONE_SESSION_LOOKUP_PATH = '/api/session';

export type Rewrite = { source: string; destination: string };

/**
 * The rewrites that put the relay behind the faucet's origin. Empty when the
 * relay's address is not configured, so a deployment without a relay has no
 * dangling proxy routes. The address is the relay's HTTPS base URL with no
 * trailing slash, for example https://relay.bsvfaucet.com.
 */
export function walletRelayRewrites(relayUrl: string | undefined): Rewrite[] {
  if (!relayUrl) return [];
  const base = relayUrl.replace(/\/+$/, '');
  return [
    { source: `${RELAY_API_PATH}/:path*`, destination: `${base}/api/:path*` },
    {
      source: `${PHONE_SESSION_LOOKUP_PATH}/:id`,
      destination: `${base}/api/session/:id`
    }
  ];
}

/** Where the QR page sends the user back to, per mode. */
export function backToAuthPath(mode: 'sign-in' | 'sign-up'): string {
  return mode === 'sign-up' ? '/sign-up' : '/sign-in';
}

/**
 * The QR page's URL from the sign-in or sign-up card, carrying the mode (for
 * the copy) and the redirect target. The target is re-checked on the server
 * when the page renders, so a crafted link cannot smuggle an off-site URL.
 */
export function mobileSignInHref(
  mode: 'sign-in' | 'sign-up',
  redirectTo: string
): string {
  const params = new URLSearchParams();
  if (mode === 'sign-up') params.set('mode', 'sign-up');
  if (redirectTo && redirectTo !== '/dashboard') {
    params.set('redirect_url', redirectTo);
  }
  const query = params.toString();
  return query ? `${MOBILE_SIGN_IN_PATH}?${query}` : MOBILE_SIGN_IN_PATH;
}
