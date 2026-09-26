import { beforeEach, describe, expect, it, vi } from 'vitest';

// The BEEF route, with the database and WhatsOnChain replaced. The fixture is
// real testnet BEEF for TXID as served by WhatsOnChain.
const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  getTransactionBeef: vi.fn()
}));

vi.mock('@/lib/prisma', () => ({
  prisma: { transaction: { findUnique: mocks.findUnique } }
}));
vi.mock('@/lib/wallet/whatsOnChain', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/wallet/whatsOnChain')>()),
  getTransactionBeef: mocks.getTransactionBeef
}));

import { GET } from '@/app/api/transactions/[txid]/beef/route';
import { ProviderError } from '@/lib/wallet/whatsOnChain';

const TXID = 'b456093fdb82a5367aa8b7e6d8902eb636e88158c848eabdd3ef908b8c112ba2';
const BEEF_HEX =
  '0100beef01feceda1a0001010002a22b118c8b90efd3bdea48c85881e836b62e90d8e6b7a87a36a582db3f0956b40101000000010000000000000000000000000000000000000000000000000000000000000000ffffffff1203ceda1a0d546573746e6574204d696e6572ffffffff01f2052a01000000001976a9140e84c845ae3af3ba20e8da29a4827abe93b639a488ac000000000100';

const get = (txid: string) =>
  GET(new Request(`http://localhost/api/transactions/${txid}/beef`), {
    params: Promise.resolve({ txid })
  });

describe('GET /api/transactions/[txid]/beef', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    mocks.findUnique.mockResolvedValue({ txid: TXID, testnetFlag: true });
    mocks.getTransactionBeef.mockResolvedValue(`${BEEF_HEX}\n`);
  });

  it('serves the BEEF hex for a faucet transaction, fetched from testnet', async () => {
    const response = await get(TXID);

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/plain');
    expect(await response.text()).toBe(BEEF_HEX);
    expect(mocks.getTransactionBeef).toHaveBeenCalledWith(TXID, 'testnet');
  });

  it('rejects a malformed txid without touching the database', async () => {
    const response = await get('not-a-txid');

    expect(response.status).toBe(400);
    expect(mocks.findUnique).not.toHaveBeenCalled();
  });

  it('refuses txids the faucet did not record', async () => {
    mocks.findUnique.mockResolvedValue(null);

    const response = await get(TXID);

    expect(response.status).toBe(404);
    expect(mocks.getTransactionBeef).not.toHaveBeenCalled();
  });

  it('refuses BEEF that does not contain the requested txid', async () => {
    const other = 'ab'.repeat(32);
    mocks.findUnique.mockResolvedValue({ txid: other, testnetFlag: true });

    const response = await get(other);

    expect(response.status).toBe(500);
  });

  it('reports a WhatsOnChain outage as 503', async () => {
    mocks.getTransactionBeef.mockRejectedValue(
      new ProviderError('down', { status: 502, attempts: 3 })
    );

    const response = await get(TXID);

    expect(response.status).toBe(503);
  });
});
