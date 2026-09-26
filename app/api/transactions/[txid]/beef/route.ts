import { Beef } from '@bsv/sdk';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getTransactionBeef, ProviderError } from '@/lib/wallet/whatsOnChain';

const TXID_PATTERN = /^[0-9a-f]{64}$/i;

// Serves a faucet transaction as BEEF hex. Public BEEF services only index
// mainnet, so the faucet builds the link itself and fetches from
// WhatsOnChain on the transaction's own network. Only transactions the
// faucet recorded are served, so this is not an open proxy for the API key.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ txid: string }> }
) {
  const { txid } = await params;
  if (!TXID_PATTERN.test(txid)) {
    return NextResponse.json({ error: 'Invalid txid' }, { status: 400 });
  }

  const transaction = await prisma.transaction.findUnique({
    where: { txid: txid.toLowerCase() },
    select: { txid: true, testnetFlag: true }
  });
  if (!transaction) {
    return NextResponse.json({ error: 'Transaction not found' }, { status: 404 });
  }

  try {
    const beefHex = (
      await getTransactionBeef(
        transaction.txid,
        transaction.testnetFlag ? 'testnet' : 'mainnet'
      )
    ).trim();

    // Refuse to hand out anything that does not parse as BEEF for this txid.
    const beef = Beef.fromString(beefHex, 'hex');
    if (!beef.findTxid(transaction.txid) || !beef.isValid()) {
      throw new Error('WhatsOnChain returned BEEF that does not match the txid');
    }

    return new NextResponse(beefHex, {
      headers: { 'Content-Type': 'text/plain; charset=utf-8' }
    });
  } catch (error) {
    console.error(`Error fetching BEEF for ${transaction.txid}:`, error);
    const upstream = error instanceof ProviderError && error.isUpstreamFailure;
    return NextResponse.json(
      {
        error: upstream
          ? 'The blockchain provider (WhatsOnChain) is currently unavailable. Please try again later.'
          : 'Failed to build BEEF for this transaction'
      },
      { status: upstream ? 503 : 500 }
    );
  }
}
