import { prisma } from '@/lib/prisma';
import { createAndSendTransaction } from '@/lib/wallet/transactions';
import { currentUser } from '@clerk/nextjs/server';
import { error } from 'console';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  // Refuse before anything is broadcast when the signed-in user has no User
  // row. The daily limit is counted from Transaction rows, and the Transaction
  // insert in createAndSendTransaction needs this row for its foreign key. It
  // runs after the broadcast, so without this check the coins would leave the
  // treasury, the insert would throw and nothing would count towards the limit.
  // This is fetchUser() inlined, because the Clerk user is needed below too.
  const clerkUser = await currentUser();
  const dbUser = clerkUser
    ? await prisma.user.findUnique({ where: { userId: clerkUser.id } })
    : null;
  if (!clerkUser || !dbUser) {
    return NextResponse.json(
      {
        error:
          'Your faucet account is not ready yet. Please try again in a minute.'
      },
      { status: 409 }
    );
  }
  const userId = dbUser.userId;

  // Eligibility. With email optional on the Clerk instance, someone can sign
  // up through the Clerk widget with only a username and password: no
  // verified email and no wallet. Enforce it here rather than trusting Clerk
  // settings. authMethod is only ever set to wallet by the server, after a
  // verified wallet proof.
  const hasVerifiedEmail = clerkUser.emailAddresses.some(
    (address) => address.verification?.status === 'verified'
  );
  if (dbUser.authMethod !== 'wallet' && !hasVerifiedEmail) {
    return NextResponse.json(
      {
        error:
          'Add an email address or sign in with a BSV wallet to request coins.'
      },
      { status: 403 }
    );
  }

  // The per-account daily limit below is the only brake on withdrawals. A
  // new wallet key costs nothing and gets a fresh limit, so a global daily
  // cap, a per-address limit, a captcha and a smaller first-day allowance for
  // wallet accounts were considered and deliberately not built.

  const { toAddress, amount } = await req.json();

  if (!toAddress || !amount) {
    return NextResponse.json(
      { error: 'toAddress and amount are required' },
      { status: 400 }
    );
  }

  // The treasury WIF is read server-side only and is never sent by the client.
  const wif = process.env.TREASURY_WALLET_WIF;
  if (!wif) {
    return NextResponse.json(
      { error: 'Treasury wallet is not configured' },
      { status: 500 }
    );
  }

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

    const DAILY_LIMIT = parseInt(process.env.NEXT_PUBLIC_MAX_DAILY_WITHDRAWAL || '1000000');
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
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error sending transaction:', message, error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
