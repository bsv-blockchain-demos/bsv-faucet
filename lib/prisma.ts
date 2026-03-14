import {
  PrismaClient,
  User as PrismaUser,
  Transaction as PrismaTransaction
} from '@/prisma/generated/client';
import { currentUser } from '@clerk/nextjs/server';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma = globalForPrisma.prisma || new PrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export type User = PrismaUser;

export type Transaction = Omit<PrismaTransaction, 'beefTx'> & {
  beefTx: { txid: string };
};

export type TransactionWithUser = Transaction & { user: User | null };

export const fetchUser = async () => {
  const user = await currentUser();
  if (!user) {
    return null;
  }
  return prisma.user.findUnique({
    where: { userId: user.id }
  });
};

export const fetchTransactions = async (user: User, take?: number) => {
  const transactions = await prisma.transaction.findMany({
    where: user.role === 'admin' ? {} : { userId: user.userId },
    include: { user: true },
    orderBy: { date: 'desc' },
    take
  });
  return transactions.map((transaction) => {
    const beefTx = transaction.beefTx as { txid: string };
    return {
      ...transaction,
      beefTx: { txid: beefTx.txid }
    };
  });
};

export type ClientUser = Omit<User, 'withdrawn' | 'createdAt' | 'lastActive'> & {
  withdrawn: number;
  createdAt: string;
  lastActive: string;
};

export type ClientTransaction = Omit<Transaction, 'amount' | 'date'> & {
  amount: number;
  date: string;
  user: ClientUser | null;
};

export function serializeUser(user: User): ClientUser {
  return {
    ...user,
    withdrawn: Number(user.withdrawn),
    createdAt: user.createdAt.toISOString(),
    lastActive: user.lastActive.toISOString()
  };
}

export function serializeTransactions(
  transactions: TransactionWithUser[]
): ClientTransaction[] {
  return transactions.map((t) => ({
    ...t,
    amount: Number(t.amount),
    date: t.date.toISOString(),
    user: t.user
      ? {
          ...t.user,
          withdrawn: Number(t.user.withdrawn),
          createdAt: t.user.createdAt.toISOString(),
          lastActive: t.user.lastActive.toISOString()
        }
      : null
  }));
}

export const fetchUsers = async (user: User) => {
  if (user.role !== 'admin') {
    return [];
  }
  return prisma.user.findMany({
    where: {},
    orderBy: { createdAt: 'desc' }
  });
};
