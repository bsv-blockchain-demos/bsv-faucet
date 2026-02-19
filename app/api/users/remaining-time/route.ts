import { PrismaClient } from '@/prisma/generated/client';
import { NextResponse } from 'next/server';

const prisma = new PrismaClient();
const MAX_DAILY_WITHDRAWAL = parseInt(
  process.env.NEXT_PUBLIC_MAX_DAILY_WITHDRAWAL || '1000000'
);
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const userId = searchParams.get('userId');

  if (!userId) {
    return NextResponse.json({ error: 'userId is required' }, { status: 400 });
  }

  try {
    const last24Hours = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const lastTransaction = await prisma.transaction.findFirst({
      where: {
        userId: userId,
        date: {
          gte: last24Hours,
        },
        txType: 'withdraw',
      },
      orderBy: {
        date: 'desc',
      },
      select: {
        date: true,
        amount: true,
      },
    });

    const totalWithdrawn = await prisma.transaction.aggregate({
      where: {
        userId: userId,
        date: {
          gte: last24Hours,
        },
        txType: 'withdraw',
      },
      _sum: {
        amount: true,
      },
    });

    const totalAmountWithdrawn = totalWithdrawn._sum.amount || 0;

    // Convert BigInt to string if it's a BigInt
    const totalAmountWithdrawnStr = totalAmountWithdrawn.toString();

    const hasReachedLimit = Number(totalAmountWithdrawnStr) >= MAX_DAILY_WITHDRAWAL;

    let remainingTime = 0;
    if (lastTransaction) {
      remainingTime = Math.max(0, 24 * 60 * 60 * 1000 - (Date.now() - lastTransaction.date.getTime()));
    }

    return NextResponse.json({
      remainingTime,
      totalAmountWithdrawn: totalAmountWithdrawnStr, // Return as string
      limitExceeded: hasReachedLimit,
      message: hasReachedLimit
        ? 'You have reached your maximum daily withdrawal limit of 100,000'
        : 'You can make a withdrawal now',
    });
    
  } catch (error) {
    console.error('Error fetching remaining time:', error);
    return NextResponse.json(
      { error: 'Error fetching remaining time' },
      { status: 500 }
    );
  } finally {
    await prisma.$disconnect();
  }
}
