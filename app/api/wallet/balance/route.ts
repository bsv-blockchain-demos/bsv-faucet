import {
  FRESH_TTL_MS,
  isFresh,
  isServableWhileStale,
  readCachedBalance,
  writeCachedBalance,
} from '@/lib/wallet/balanceCache';
import { ProviderError, getBalance } from '@/lib/wallet/whatsOnChain';
import { PrivateKey } from '@bsv/sdk';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const PROVIDER_DOWN_MESSAGE =
  'The blockchain provider (WhatsOnChain) is currently unavailable. Showing the last known balance.';

export async function GET() {
  const treasuryWIF = process.env.TREASURY_WALLET_WIF;
  if (!treasuryWIF) {
    return NextResponse.json({ error: 'No wallet found' }, { status: 404 });
  }

  let address: string;
  try {
    address = PrivateKey.fromWif(treasuryWIF).toAddress('testnet').toString();
  } catch (error) {
    console.error('Treasury WIF is not a valid private key:', error);
    return NextResponse.json(
      { error: 'Treasury wallet is misconfigured' },
      { status: 500 }
    );
  }

  const cached = await readCachedBalance(address);

  // Serve a recent reading without hitting the provider. Several dashboards
  // polling on a 60s timer collapse into one upstream call per window.
  if (cached && isFresh(cached)) {
    return balanceResponse({ balance: cached.balance, asOf: cached.fetchedAt });
  }

  try {
    // The UTXO endpoint pages at 1000 and the treasury holds far more than
    // that, so summing UTXOs undercounts. The balance endpoint is exact.
    const balance = await getBalance(address);
    const entry = await writeCachedBalance(address, balance);

    return balanceResponse({ balance, asOf: entry.fetchedAt });
  } catch (error) {
    const isProviderOutage =
      error instanceof ProviderError && error.isUpstreamFailure;
    console.error(
      isProviderOutage
        ? 'WhatsOnChain unavailable while fetching treasury balance'
        : 'Failed to fetch treasury balance',
      error
    );

    // Degrade to the last good reading rather than failing the dashboard.
    if (cached && isServableWhileStale(cached)) {
      return balanceResponse({
        balance: cached.balance,
        asOf: cached.fetchedAt,
        stale: true,
        warning: PROVIDER_DOWN_MESSAGE,
      });
    }

    return NextResponse.json(
      {
        error: isProviderOutage
          ? 'The blockchain provider (WhatsOnChain) is currently unavailable. Please try again later.'
          : 'Error fetching balance',
        stale: false,
      },
      { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '60' } }
    );
  }
}

function balanceResponse({
  balance,
  asOf,
  stale = false,
  warning,
}: {
  balance: number;
  asOf: number;
  stale?: boolean;
  warning?: string;
}) {
  return NextResponse.json(
    {
      balance,
      stale,
      asOf: new Date(asOf).toISOString(),
      ...(warning ? { warning } : {}),
    },
    {
      headers: {
        'Cache-Control': `private, max-age=0, stale-while-revalidate=${Math.floor(
          FRESH_TTL_MS / 1000
        )}`,
      },
    }
  );
}
