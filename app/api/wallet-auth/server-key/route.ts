import { getServerPublicKey } from '@/lib/walletAuthServer';
import { WALLET_AUTH_ENABLED } from '@/lib/walletAuth';

export const dynamic = 'force-dynamic';

// The public half of the faucet's auth key. Wallets sign their proofs towards
// it. It is public by nature, so this route is public in middleware.ts.
export async function GET() {
  if (!WALLET_AUTH_ENABLED) {
    return Response.json({ error: 'not_found' }, { status: 404 });
  }
  try {
    return Response.json({ publicKey: getServerPublicKey() });
  } catch (error) {
    console.error('[wallet-auth]', (error as Error).message);
    return Response.json(
      { error: 'wallet_auth_unavailable' },
      { status: 503 }
    );
  }
}
