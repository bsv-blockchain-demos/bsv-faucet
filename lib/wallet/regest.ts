import axios, { AxiosRequestConfig } from 'axios';

const API_URLS = {
  testnet: 'https://api.whatsonchain.com/v1/bsv/test',
  mainnet: 'https://api.whatsonchain.com/v1/bsv/main',
};

const REQUEST_TIMEOUT_MS = 10_000;
const MAX_ATTEMPTS = 3;
const BASE_BACKOFF_MS = 250;
// The public rate limit is per second, so a sub-second retry after a 429 just
// burns an attempt inside the same window.
const RATE_LIMIT_BACKOFF_MS = 1_000;
const MAX_BACKOFF_MS = 10_000;

/**
 * WhatsOnChain authenticates with the bare API key in the Authorization header.
 * Unauthenticated calls share a low per-IP limit, and on Vercel that IP is
 * shared with other tenants, so without a key the faucet trips 429s under
 * ordinary load. The key is optional so local development still works without
 * one. Server-only: never expose it with a NEXT_PUBLIC_ prefix.
 */
const authHeaders = (): Record<string, string> => {
  const apiKey = process.env.WOC_API_KEY?.trim();
  return apiKey ? { Authorization: apiKey } : {};
};

/** Retry-After is either seconds or an HTTP date. Anything else is ignored. */
const parseRetryAfter = (value: unknown): number | undefined => {
  if (typeof value !== 'string' || value.trim() === '') return undefined;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const at = Date.parse(value);
  return Number.isNaN(at) ? undefined : Math.max(0, at - Date.now());
};

/**
 * Error raised when a WhatsOnChain request fails. Preserves the upstream HTTP
 * status so callers can tell a provider outage (5xx / network) apart from a
 * genuine client mistake such as a malformed address (4xx).
 */
export class ProviderError extends Error {
  readonly status?: number;
  readonly attempts: number;

  constructor(
    message: string,
    options: { status?: number; attempts: number; cause?: unknown }
  ) {
    super(message);
    this.name = 'ProviderError';
    this.status = options.status;
    this.attempts = options.attempts;
    this.cause = options.cause;
  }

  /** True when the provider itself is at fault and the call is worth retrying later. */
  get isUpstreamFailure(): boolean {
    return (
      this.status === undefined || this.status >= 500 || this.status === 429
    );
  }
}

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** Retry network errors, timeouts, rate limits and 5xx. Never retry other 4xx. */
const isRetryable = (status: number | undefined) =>
  status === undefined || status >= 500 || status === 429;

/**
 * Issue a request against WhatsOnChain with a bounded number of retries and
 * exponential backoff with jitter. WhatsOnChain returns intermittent 5xx even
 * in normal operation, so a single failed attempt should never surface to the
 * caller as an outage. Rate-limit responses honour Retry-After when present
 * and otherwise wait at least a full limit window before trying again.
 */
const request = async <T>(
  description: string,
  config: AxiosRequestConfig,
  { retry = true }: { retry?: boolean } = {}
): Promise<T> => {
  const maxAttempts = retry ? MAX_ATTEMPTS : 1;
  let lastStatus: number | undefined;
  let lastError: unknown;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await axios.request<T>({
        timeout: REQUEST_TIMEOUT_MS,
        ...config,
        headers: { ...authHeaders(), ...config.headers },
      });
      return response.data;
    } catch (error) {
      lastError = error;
      lastStatus = axios.isAxiosError(error)
        ? error.response?.status
        : undefined;

      if (!isRetryable(lastStatus) || attempt === maxAttempts) {
        break;
      }

      // Exponential backoff with jitter so concurrent callers do not retry in lockstep.
      const exponential = BASE_BACKOFF_MS * 2 ** (attempt - 1);
      const floor = lastStatus === 429 ? RATE_LIMIT_BACKOFF_MS : 0;
      const retryAfter = axios.isAxiosError(error)
        ? parseRetryAfter(error.response?.headers?.['retry-after'])
        : undefined;
      const backoff = Math.max(exponential, floor, retryAfter ?? 0);
      await sleep(Math.min(backoff + Math.random() * backoff, MAX_BACKOFF_MS));
    }
  }

  const statusText = lastStatus ? `HTTP ${lastStatus}` : 'network error';
  const attemptText = maxAttempts === 1 ? '1 attempt' : `${maxAttempts} attempts`;
  throw new ProviderError(
    `${description}: WhatsOnChain request failed after ${attemptText} (${statusText})`,
    { status: lastStatus, attempts: maxAttempts, cause: lastError }
  );
};

export const getUTXOs = async (
  address: string,
  network: 'testnet' | 'mainnet' = 'testnet'
) => {
  const apiUrl = API_URLS[network];
  const data = await request<{ result?: unknown } | unknown[]>(
    'Error fetching UTXOs',
    {
      method: 'GET',
      url: `${apiUrl}/address/${address}/unspent/all`,
    }
  );

  // `/unspent/all` wraps the list in `result`; older endpoints return a bare array.
  if (Array.isArray(data)) return data;
  return Array.isArray(data?.result) ? data.result : [];
};

/** Confirmed plus unconfirmed balance in satoshis, in a single request. */
export const getBalance = async (
  address: string,
  network: 'testnet' | 'mainnet' = 'testnet'
): Promise<number> => {
  const apiUrl = API_URLS[network];
  const data = await request<{ confirmed?: number; unconfirmed?: number }>(
    'Error fetching balance',
    { method: 'GET', url: `${apiUrl}/address/${address}/balance` }
  );
  return (data.confirmed ?? 0) + (data.unconfirmed ?? 0);
};

export const broadcastTransaction = async (
  rawTx: string,
  network: 'testnet' | 'mainnet' = 'testnet'
) => {
  const apiUrl = API_URLS[network];
  // Deliberately not retried: a broadcast that timed out may still have landed,
  // and a second attempt would come back as "txn-already-known" and read as a
  // failure for a transaction that actually succeeded.
  return request<string>(
    'Error broadcasting transaction',
    {
      method: 'POST',
      url: `${apiUrl}/tx/raw`,
      data: { txhex: rawTx },
    },
    { retry: false }
  );
};

export const getRawTransaction = async (
  tx_hash: string,
  network: 'testnet' | 'mainnet' = 'testnet'
) => {
  const apiUrl = API_URLS[network];
  return request<string>('Error fetching raw transaction', {
    method: 'GET',
    url: `${apiUrl}/tx/${tx_hash}/hex`,
  });
};
