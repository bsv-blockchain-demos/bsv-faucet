import type { WalletProtocol } from '@bsv/sdk';

// Shared by the browser and the route handlers so the two sides cannot
// disagree about the protocol. Nothing in this file may be secret.

/**
 * Shown in the wallet's permission prompt on first use, and it drives key
 * derivation, so it must be identical on both sides. Letters, numbers and
 * spaces only. Changing it invalidates every wallet's existing permission
 * grant, so users would be asked to approve the faucet again.
 */
export const AUTH_PROTOCOL: WalletProtocol = [2, 'bsv faucet login'];

/** The action a sign-in proof authorises. */
export const LOGIN_ACTION = 'login';

/** The action a wallet account's self-deletion proof authorises. */
export const DELETE_ACCOUNT_ACTION = 'delete-account';

/**
 * NEXT_PUBLIC_ so the client bundle can read it. Next inlines it at build time
 * in both bundles, so the server routes and the pages always agree.
 */
export const WALLET_AUTH_ENABLED =
  process.env.NEXT_PUBLIC_WALLET_AUTH_ENABLED === 'true';

/** The prefix every generated wallet username starts with. */
export const WALLET_USERNAME_PREFIX = 'bsv_';

const IDENTITY_KEY_PATTERN = /^0[23][0-9a-f]{64}$/;

/**
 * A wallet identity key is a 33 byte compressed secp256k1 public key: 66
 * lowercase hex characters starting 02 or 03. Check this before using a key
 * that came from a proof, since the proof library only checks it is a string.
 */
export function isIdentityKey(value: unknown): value is string {
  return typeof value === 'string' && IDENTITY_KEY_PATTERN.test(value);
}

/**
 * The faucet database username for a wallet account: the parity prefix
 * dropped, then the next 16 hex characters, or 32 for the long form. Clerk
 * holds no username for wallet accounts, because username sign-in is off on
 * the instance, but User.username is required and unique here. The long form
 * is the fallback when another row already holds the short one.
 */
export function walletUsername(
  identityKey: string,
  form: 'short' | 'long' = 'short'
): string {
  return (
    WALLET_USERNAME_PREFIX +
    identityKey.slice(2, form === 'short' ? 18 : 34)
  );
}

/** The first 8 characters, which is all the server logs of a key. */
export function keyFingerprint(identityKey: string): string {
  return identityKey.slice(0, 8);
}

/** For tables and exports where the full 66 characters will not fit. */
export function truncateIdentityKey(identityKey: string): string {
  return `${identityKey.slice(0, 8)}…${identityKey.slice(-6)}`;
}

/**
 * The avatar fallback character for a user. Every wallet username starts
 * `bsv_`, so taking its first character would put the same "B" on every
 * wallet account. For wallet accounts, use the characters after the prefix,
 * which are the head of the identity key. The check is on authMethod, never
 * on the prefix alone, because an email user can pick a `bsv_` username too.
 */
export function avatarInitials(user: {
  username: string | null;
  authMethod?: string | null;
}): string {
  const username = user.username ?? '';
  if (
    user.authMethod === 'wallet' &&
    username.startsWith(WALLET_USERNAME_PREFIX)
  ) {
    return username.slice(WALLET_USERNAME_PREFIX.length, WALLET_USERNAME_PREFIX.length + 2).toUpperCase();
  }
  return username.charAt(0).toUpperCase();
}

/**
 * Where to send the user after signing in. Only a same-origin target is
 * honoured, so a crafted redirect_url cannot bounce a freshly signed-in user
 * to another site. Anything else, including a malformed value, falls back.
 */
export function safeRedirectPath(
  raw: string | null | undefined,
  origin: string,
  fallback = '/dashboard'
): string {
  if (!raw) return fallback;
  try {
    const url = new URL(raw, origin);
    if (url.origin !== new URL(origin).origin) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
