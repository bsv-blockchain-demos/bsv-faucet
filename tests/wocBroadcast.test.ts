import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axios, { AxiosError, AxiosHeaders } from 'axios';
import { P2PKH, PrivateKey, Transaction } from '@bsv/sdk';
import { broadcastTransaction } from '@/lib/wallet/whatsOnChain';

// broadcastTransaction with axios replaced, so each test decides how
// WhatsOnChain answers every attempt.
const httpError = (status: number, data: unknown = '') => {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError(`HTTP ${status}`, 'ERR_BAD_RESPONSE', config, null, {
    status,
    statusText: '',
    headers: {},
    config,
    data
  });
};

const tx = new Transaction();
tx.addOutput({
  lockingScript: new P2PKH().lock(PrivateKey.fromRandom().toAddress('testnet')),
  satoshis: 1_000
});
const rawTx = tx.toHex();
const txid = tx.id('hex');

const broadcast = async () => {
  const result = broadcastTransaction(rawTx).then(
    (value) => ({ value }),
    (error: Error) => ({ error })
  );
  await vi.runAllTimersAsync();
  return result;
};

describe('broadcastTransaction', () => {
  let request: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.useFakeTimers();
    request = vi.spyOn(axios, 'request');
  });

  afterEach(() => {
    request.mockRestore();
    vi.useRealTimers();
  });

  it('retries after a 429 and returns the txid', async () => {
    request
      .mockRejectedValueOnce(httpError(429))
      .mockResolvedValueOnce({ data: txid });

    expect(await broadcast()).toEqual({ value: txid });
    expect(request).toHaveBeenCalledTimes(2);
  });

  it('gives up after three 429s and says so', async () => {
    request.mockRejectedValue(httpError(429));

    const { error } = (await broadcast()) as { error: Error };
    expect(error.message).toContain('after 3 attempts (HTTP 429)');
    expect(request).toHaveBeenCalledTimes(3);
  });

  it.each([500, 502, 400])('does not retry an HTTP %i', async (status) => {
    request.mockRejectedValue(httpError(status));

    const { error } = (await broadcast()) as { error: Error };
    expect(error.message).toContain(`after 1 attempt (HTTP ${status})`);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('does not retry a timeout', async () => {
    request.mockRejectedValue(new AxiosError('timeout', 'ECONNABORTED'));

    const { error } = (await broadcast()) as { error: Error };
    expect(error.message).toContain('after 1 attempt (network error)');
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('treats an already-known transaction on the retry as sent', async () => {
    request
      .mockRejectedValueOnce(httpError(429))
      .mockRejectedValueOnce(httpError(400, '257: txn-already-known'));

    expect(await broadcast()).toEqual({ value: txid });
  });
});
