import { PrivateKey } from '@bsv/sdk';
import { NextResponse } from 'next/server';

// Returns only the treasury wallet's public testnet address.
// The WIF stays server-side; deriving the address here keeps the private key
// out of the client bundle (it must never be a NEXT_PUBLIC_ var).
export async function GET() {
  const treasuryWIF = process.env.TREASURY_WALLET_WIF;
  if (!treasuryWIF) {
    return NextResponse.json(
      { error: 'Treasury wallet is not configured' },
      { status: 500 }
    );
  }

  try {
    const address = PrivateKey.fromWif(treasuryWIF).toAddress('testnet').toString();
    return NextResponse.json({ address });
  } catch (error) {
    console.error('Error deriving treasury address:', error);
    return NextResponse.json(
      { error: 'Error deriving treasury address' },
      { status: 500 }
    );
  }
}
