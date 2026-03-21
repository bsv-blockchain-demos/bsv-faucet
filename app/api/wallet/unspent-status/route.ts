import { startSpentMonitor } from '@/lib/wallet/updateSpentStatus';
import { NextResponse } from 'next/server';

export const maxDuration = 30;

export async function GET() {
  try {
    await startSpentMonitor();
    return NextResponse.json({ message: 'Spent status monitor started' });
  } catch (error) {
    console.error('Error in starting monitor:', error);
    const message = error instanceof Error && error.message.includes('Error fetching UTXOs')
      ? 'The blockchain provider (WhatsOnChain) is currently unavailable. Spent status update skipped.'
      : 'Failed to start spent status monitor';
    return NextResponse.json(
      { error: message },
      { status: 503 }
    );
  }
}
