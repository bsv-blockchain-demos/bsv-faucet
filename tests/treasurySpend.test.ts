import { beforeEach, describe, expect, it, vi } from 'vitest';
import { P2PKH, PrivateKey, Transaction } from '@bsv/sdk';

// createAndSendTransaction with WhatsOnChain, Clerk and the database replaced,
// so the test sees exactly which UTXOs the treasury tries to spend.
const mocks = vi.hoisted(() => ({
  getUTXOs: vi.fn(),
  getRawTransaction: vi.fn(),
  broadcastTransaction: vi.fn()
}));

vi.mock('@/lib/wallet/whatsOnChain', () => mocks);
vi.mock('@clerk/nextjs/server', () => ({
  currentUser: vi.fn(async () => ({ id: 'user_1' }))
}));
vi.mock('@/prisma/generated/client', () => ({
  Prisma: {},
  PrismaClient: class {
    transaction = { create: vi.fn() };
    user = { update: vi.fn() };
    $disconnect = vi.fn();
  }
}));

import { createAndSendTransaction } from '@/lib/wallet/transactions';

const treasury = PrivateKey.fromRandom();
const treasuryAddress = treasury.toAddress('testnet');
const recipient = PrivateKey.fromRandom().toAddress('testnet');

// A funding transaction with one output per value, all paying the treasury.
const funding = (values: number[]) => {
  const tx = new Transaction();
  for (const satoshis of values) {
    tx.addOutput({ lockingScript: new P2PKH().lock(treasuryAddress), satoshis });
  }
  return tx;
};

describe('createAndSendTransaction UTXO selection', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.broadcastTransaction.mockImplementation(async (hex: string) =>
      Transaction.fromHex(hex).id('hex')
    );
  });

  it('skips outputs already spent by a mempool transaction', async () => {
    const source = funding([50_000, 50_000]);
    const txid = source.id('hex');
    mocks.getRawTransaction.mockResolvedValue(source.toHex());
    mocks.getUTXOs.mockResolvedValue([
      { tx_hash: txid, tx_pos: 0, value: 50_000, isSpentInMempoolTx: true },
      { tx_hash: txid, tx_pos: 1, value: 50_000, isSpentInMempoolTx: false }
    ]);

    await createAndSendTransaction(treasury.toWif(), recipient, 10_000);

    const sent = Transaction.fromHex(mocks.broadcastTransaction.mock.calls[0][0]);
    expect(sent.inputs.map((input) => input.sourceOutputIndex)).toEqual([1]);
  });

  it('spends an output listed twice only once', async () => {
    const source = funding([6_000, 6_000]);
    const txid = source.id('hex');
    mocks.getRawTransaction.mockResolvedValue(source.toHex());
    mocks.getUTXOs.mockResolvedValue([
      { tx_hash: txid, tx_pos: 0, value: 6_000, status: 'unconfirmed' },
      { tx_hash: txid, tx_pos: 0, value: 6_000, status: 'confirmed' },
      { tx_hash: txid, tx_pos: 1, value: 6_000, status: 'confirmed' }
    ]);

    await createAndSendTransaction(treasury.toWif(), recipient, 10_000);

    const sent = Transaction.fromHex(mocks.broadcastTransaction.mock.calls[0][0]);
    expect(sent.inputs.map((input) => input.sourceOutputIndex)).toEqual([0, 1]);
  });

  it('refuses to send when every output is already spent in the mempool', async () => {
    const source = funding([50_000]);
    mocks.getRawTransaction.mockResolvedValue(source.toHex());
    mocks.getUTXOs.mockResolvedValue([
      { tx_hash: source.id('hex'), tx_pos: 0, value: 50_000, isSpentInMempoolTx: true }
    ]);

    await expect(
      createAndSendTransaction(treasury.toWif(), recipient, 10_000)
    ).rejects.toThrow('No UTXOs available');
    expect(mocks.broadcastTransaction).not.toHaveBeenCalled();
  });
});
