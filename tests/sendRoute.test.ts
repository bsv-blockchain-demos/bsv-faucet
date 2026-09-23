import { beforeEach, describe, expect, it, vi } from 'vitest';

// The send route, with Clerk, the database and the broadcaster replaced.
// createAndSendTransaction is where coins leave the treasury, so "nothing is
// broadcast" means it was never called.
const mocks = vi.hoisted(() => ({
  currentUser: vi.fn(),
  findUnique: vi.fn(),
  findMany: vi.fn(),
  update: vi.fn(),
  createAndSendTransaction: vi.fn()
}));

vi.mock('@clerk/nextjs/server', () => ({ currentUser: mocks.currentUser }));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: mocks.findUnique, update: mocks.update },
    transaction: { findMany: mocks.findMany }
  }
}));
vi.mock('@/lib/wallet/transactions', () => ({
  createAndSendTransaction: mocks.createAndSendTransaction
}));

import { POST } from '@/app/api/wallet/send/route';

const DAILY_LIMIT = 1_000_000;

const clerkUser = (verifiedEmail: boolean) => ({
  id: 'user_1',
  emailAddresses: verifiedEmail
    ? [{ emailAddress: 'a@example.com', verification: { status: 'verified' } }]
    : []
});

const row = (authMethod: 'email' | 'wallet') => ({
  userId: 'user_1',
  authMethod,
  identityKey: authMethod === 'wallet' ? '02' + 'ab'.repeat(32) : null
});

const send = (amount: number) =>
  POST(
    new Request('http://localhost/api/wallet/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ toAddress: 'mzBc4XEFSdzCDcTxAgf6EZXgsZWpztRhef', amount })
    })
  );

beforeEach(() => {
  vi.resetAllMocks();
  vi.unstubAllEnvs();
  vi.stubEnv('NEXT_PUBLIC_MAX_DAILY_WITHDRAWAL', String(DAILY_LIMIT));
  // The route refuses to run without this variable set. It is only ever
  // passed to the mocked broadcaster above, so a placeholder is enough.
  vi.stubEnv('TREASURY_WALLET_WIF', 'placeholder-not-a-key');
  mocks.findMany.mockResolvedValue([]);
  mocks.createAndSendTransaction.mockResolvedValue('txid_1');
});

describe('POST /api/wallet/send', () => {
  it('returns 409 and broadcasts nothing for a signed-in user with no row', async () => {
    mocks.currentUser.mockResolvedValue(clerkUser(true));
    mocks.findUnique.mockResolvedValue(null);

    const res = await send(1000);

    expect(res.status).toBe(409);
    expect(mocks.createAndSendTransaction).not.toHaveBeenCalled();
  });

  it('refuses an account with neither a verified email nor a wallet', async () => {
    mocks.currentUser.mockResolvedValue(clerkUser(false));
    mocks.findUnique.mockResolvedValue(row('email'));

    const res = await send(1000);

    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe(
      'Add an email address or sign in with a BSV wallet to request coins.'
    );
    expect(mocks.createAndSendTransaction).not.toHaveBeenCalled();
  });

  it.each([
    ['an email user with a verified email', clerkUser(true), row('email')],
    ['a wallet user with no email', clerkUser(false), row('wallet')]
  ])('sends for %s', async (_, user, dbRow) => {
    mocks.currentUser.mockResolvedValue(user);
    mocks.findUnique.mockResolvedValue(dbRow);

    const res = await send(1000);

    expect(res.status).toBe(200);
    expect((await res.json()).txid).toBe('txid_1');
    expect(mocks.createAndSendTransaction).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['email', clerkUser(true), row('email')],
    ['wallet', clerkUser(false), row('wallet')]
  ])('applies the daily limit to %s users in the same way', async (_, user, dbRow) => {
    mocks.currentUser.mockResolvedValue(user);
    mocks.findUnique.mockResolvedValue(dbRow);
    mocks.findMany.mockResolvedValue([{ amount: BigInt(DAILY_LIMIT - 500) }]);

    const res = await send(1000);

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Daily withdrawal limit exceeded');
    expect(mocks.createAndSendTransaction).not.toHaveBeenCalled();
    // Counted from this user's own withdrawals, whatever the account type.
    expect(mocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ userId: 'user_1', txType: 'withdraw' })
      })
    );
  });
});
