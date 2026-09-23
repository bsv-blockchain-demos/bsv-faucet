import { createAuthProof, type ProofSignerWallet } from '@bsv/auth';
import { AUTH_PROTOCOL, LOGIN_ACTION } from '@/lib/walletAuth';

// The wallet sign-in flow with no React in it, so it can run against any
// wallet that signs (BSV Desktop through WalletClient, or a phone through
// the relay's wallet proxy) and be tested with a ProtoWallet.

/** The two Clerk calls the flow makes, as the useSignIn hook provides them. */
export type WalletSignInClerk = {
  signIn: {
    create(args: { strategy: 'ticket'; ticket: string }): Promise<{
      status: string | null;
      createdSessionId: string | null;
    }>;
  };
  setActive(args: { session: string }): Promise<unknown>;
};

export type WalletSignInOptions = {
  wallet: ProofSignerWallet;
  clerk: WalletSignInClerk;
  /**
   * Checked between steps. When it returns true the flow stops quietly and
   * reports 'abandoned', so a wallet that answers after the caller gave up
   * (a timeout, an unmounted page) cannot sign the user in behind their back.
   */
  abandoned?: () => boolean;
  /** Called once the proof is signed and the server is checking it. */
  onVerifying?: () => void;
  fetchImpl?: typeof fetch;
};

/** The faucet's auth public key, which the wallet signs its proof towards. */
export async function fetchServerKey(
  fetchImpl: typeof fetch = fetch
): Promise<string> {
  const res = await fetchImpl('/api/wallet-auth/server-key');
  if (!res.ok) throw new Error(`server-key ${res.status}`);
  const { publicKey } = (await res.json()) as { publicKey: string };
  return publicKey;
}

/**
 * Signs a proof with the wallet, exchanges it at the login route for a Clerk
 * sign-in ticket, and starts an ordinary Clerk session from it. Resolves
 * 'done' once the session is active; the caller does the navigation.
 */
export async function signInWithWallet({
  wallet,
  clerk,
  abandoned = () => false,
  onVerifying,
  fetchImpl = fetch
}: WalletSignInOptions): Promise<'done' | 'abandoned'> {
  const serverKey = await fetchServerKey(fetchImpl);
  // Ask for the identity key on its own first. This is where a wallet that
  // is closed or unapproved stalls, and checking afterwards means a wallet
  // that answers after the caller's timeout is not then asked to sign.
  await wallet.getPublicKey({ identityKey: true });
  if (abandoned()) return 'abandoned';
  const proof = await createAuthProof({
    wallet,
    counterparty: serverKey,
    action: LOGIN_ACTION,
    protocol: AUTH_PROTOCOL
  });
  if (abandoned()) return 'abandoned';
  onVerifying?.();

  const res = await fetchImpl('/api/wallet-auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ proof })
  });
  if (!res.ok) throw new Error(`wallet-login ${res.status}`);
  const { ticket } = (await res.json()) as { ticket: string };
  if (abandoned()) return 'abandoned';

  const result = await clerk.signIn.create({ strategy: 'ticket', ticket });
  if (result.status !== 'complete' || !result.createdSessionId) {
    throw new Error(`ticket sign-in ended as ${result.status}`);
  }
  await clerk.setActive({ session: result.createdSessionId });
  return abandoned() ? 'abandoned' : 'done';
}
