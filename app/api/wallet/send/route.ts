import { prisma } from '@/lib/prisma';
import { createAndSendTransaction } from '@/lib/wallet/transactions';
import { currentUser } from '@clerk/nextjs/server';
import { error } from 'console';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const { wif, toAddress, amount } = await req.json();

  if (!wif || !toAddress || !amount) {
    return NextResponse.json(
      { error: 'wif, toAddress, and amount are required' },
      { status: 400 }
    );
  }
  const user = await currentUser();
  const userId = user?.id;

  try {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentWithdrawals = await prisma.transaction.findMany({
      where: {
        userId: userId,
        date: {
          gte: last24Hours
        },
        txType: 'withdraw'
      },
      select: {
        amount: true
      }
    });

    const totalWithdrawn = recentWithdrawals.reduce(
      (sum, tx) => sum + Number(tx.amount),
      0
    );

    const DAILY_LIMIT = 1000000;
    if (totalWithdrawn + amount > DAILY_LIMIT) {
      return NextResponse.json(
        { error: 'Daily withdrawal limit exceeded' },
        { status: 400 }
      );
    }
    const txid = await createAndSendTransaction(wif, toAddress, amount);

    await prisma.user.update({
      where: { userId: userId },
      data: { lastActive: new Date() }
    });

    return NextResponse.json({ txid });
  } catch (error) {
    console.error('Error sending transaction:', error);
    return NextResponse.json(
      { error: 'Error sending transaction' },
      { status: 500 }
    );
  }
}
