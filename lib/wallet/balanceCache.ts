import { prisma } from '@/lib/prisma';

/**
 * Last-known-good balance cache for the treasury address.
 *
 * WhatsOnChain is the only source of UTXO data the faucet has, and its testnet
 * index goes down for hours at a time. Without a cache every dashboard poll
 * turns an upstream outage into a 503 on our side. Holding the last successful
 * reading lets the balance endpoint degrade to a stale-but-labelled value
 * instead of failing outright.
 *
 * Two tiers:
 *  - an in-process map, which costs nothing and absorbs repeat polls on a warm
 *    function instance;
 *  - a Postgres row, so a cold instance started midway through an outage still
 *    has a reading to serve, and so instances share one refresh between them.
 *
 * The durable tier is best-effort by design. A cache is not worth failing a
 * request over, so database errors are logged and fall back to memory.
 */

export interface CachedBalance {
  balance: number;
  fetchedAt: number;
}

/** How long a reading is served without re-querying the provider. */
export const FRESH_TTL_MS = 30_000;

/** Oldest reading still worth serving while the provider is unavailable. */
export const STALE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

const memory = new Map<string, CachedBalance>();

export const isFresh = (entry: CachedBalance): boolean =>
  Date.now() - entry.fetchedAt < FRESH_TTL_MS;

export const isServableWhileStale = (entry: CachedBalance): boolean =>
  Date.now() - entry.fetchedAt <= STALE_MAX_AGE_MS;

const readDurable = async (
  address: string
): Promise<CachedBalance | undefined> => {
  try {
    const row = await prisma.balanceCache.findUnique({ where: { address } });
    if (!row) return undefined;
    return { balance: Number(row.balance), fetchedAt: row.updatedAt.getTime() };
  } catch (error) {
    console.error('Could not read the durable balance cache:', error);
    return undefined;
  }
};

const writeDurable = async (entry: CachedBalance, address: string) => {
  const updatedAt = new Date(entry.fetchedAt);
  const balance = BigInt(entry.balance);
  try {
    await prisma.balanceCache.upsert({
      where: { address },
      create: { address, balance, updatedAt },
      update: { balance, updatedAt }
    });
  } catch (error) {
    console.error('Could not write the durable balance cache:', error);
  }
};

export const readCachedBalance = async (
  address: string
): Promise<CachedBalance | undefined> => {
  const local = memory.get(address);

  // A fresh local reading is authoritative; skip the database round trip.
  if (local && isFresh(local)) return local;

  const durable = await readDurable(address);

  // Another instance may have refreshed more recently than this one has.
  if (durable && (!local || durable.fetchedAt > local.fetchedAt)) {
    memory.set(address, durable);
    return durable;
  }

  return local;
};

export const writeCachedBalance = async (
  address: string,
  balance: number
): Promise<CachedBalance> => {
  const entry: CachedBalance = { balance, fetchedAt: Date.now() };
  memory.set(address, entry);
  await writeDurable(entry, address);
  return entry;
};

/** Test helper: drop in-process readings. Leaves the durable tier untouched. */
export const clearBalanceCache = () => memory.clear();
