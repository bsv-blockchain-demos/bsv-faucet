import 'server-only';

import {
  verifyAuthProof,
  type AuthProof,
  type ProofVerifierWallet
} from '@bsv/auth';
import { PrivateKey, ProtoWallet } from '@bsv/sdk';
import { clerkClient } from '@clerk/nextjs/server';
import { isClerkAPIResponseError } from '@clerk/nextjs/errors';
import { Prisma } from '@/prisma/generated/client';
import { prisma } from '@/lib/prisma';
import {
  AUTH_PROTOCOL,
  LOGIN_ACTION,
  WALLET_AUTH_ENABLED,
  isIdentityKey,
  keyFingerprint,
  walletUsername
} from '@/lib/walletAuth';

// The login route's logic lives here rather than in the route file so it can
// be tested with a fake store and a fake Clerk. Route files may only export
// the HTTP method handlers and route config.

/** A write lost a race on a unique column, in Postgres or in Clerk. */
export class UniqueViolationError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = 'UniqueViolationError';
  }
}

/** The faucet database operations wallet sign-in needs. */
export interface WalletAuthStore {
  /**
   * Records a nonce as used. Returns false when it was already used, which
   * means the proof is a replay. Must be an atomic insert-if-absent: a
   * check-then-insert would let two concurrent requests with one nonce through.
   */
  consumeNonce(nonce: string, expiresAt: Date): Promise<boolean>;
  deleteExpiredNonces(now: Date): Promise<void>;
  findUserIdByIdentityKey(identityKey: string): Promise<string | null>;
  /**
   * Creates or completes the wallet account's User row, choosing its faucet
   * username. Throws UniqueViolationError when another row already holds this
   * identity key.
   */
  upsertWalletUser(user: {
    userId: string;
    identityKey: string;
    imageUrl: string;
  }): Promise<void>;
}

export type WalletClerkUser = {
  id: string;
  imageUrl: string;
  externalId: string | null;
};

/** The Clerk Backend API calls wallet sign-in needs. */
export interface WalletAuthClerk {
  findUserByExternalId(externalId: string): Promise<WalletClerkUser | null>;
  /** Throws UniqueViolationError when the external ID is already taken. */
  createWalletUser(user: { identityKey: string }): Promise<WalletClerkUser>;
  createSignInToken(userId: string): Promise<string>;
}

function prismaUniqueTarget(error: unknown): string | null {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002'
  ) {
    // An array of column names, or the constraint name, depending on driver.
    return JSON.stringify(error.meta?.target ?? '');
  }
  return null;
}

export const prismaWalletAuthStore: WalletAuthStore = {
  async consumeNonce(nonce, expiresAt) {
    try {
      await prisma.authNonce.create({ data: { nonce, expiresAt } });
      return true;
    } catch (error) {
      if (prismaUniqueTarget(error) !== null) return false;
      throw error;
    }
  },

  async deleteExpiredNonces(now) {
    await prisma.authNonce.deleteMany({ where: { expiresAt: { lt: now } } });
  },

  async findUserIdByIdentityKey(identityKey) {
    const row = await prisma.user.findUnique({
      where: { identityKey },
      select: { userId: true }
    });
    return row?.userId ?? null;
  },

  async upsertWalletUser({ userId, identityKey, imageUrl }) {
    // User.username is required and unique in the faucet database, but
    // Clerk has no usernames. Wallet rows get a generated one. The long form
    // is the fallback if another row already holds the short one.
    const candidates = [
      walletUsername(identityKey, 'short'),
      walletUsername(identityKey, 'long')
    ];
    for (let i = 0; i < candidates.length; i++) {
      const username = candidates[i];
      try {
        // Keyed on userId, like the Clerk webhook's upsert, so whichever of
        // the two lands first creates the row and the other only fills in
        // fields. The update never touches username, role, withdrawn or
        // paused.
        await prisma.user.upsert({
          where: { userId },
          update: { identityKey, authMethod: 'wallet' },
          create: {
            userId,
            username,
            email: null,
            identityKey,
            authMethod: 'wallet',
            imageUrl,
            role: 'user',
            theme: 'light',
            // Legacy column. Clerk holds the real credentials, and wallet
            // accounts have no password at all.
            password: ''
          }
        });
        return;
      } catch (error) {
        const target = prismaUniqueTarget(error);
        if (target === null) throw error;
        if (target.includes('username') && i < candidates.length - 1) continue;
        throw new UniqueViolationError('User row already exists', {
          cause: error
        });
      }
    }
  }
};

function toWalletClerkUser(user: {
  id: string;
  imageUrl: string;
  externalId: string | null;
}): WalletClerkUser {
  return { id: user.id, imageUrl: user.imageUrl, externalId: user.externalId };
}

export async function createClerkWalletAuth(): Promise<WalletAuthClerk> {
  const clerk = await clerkClient();
  return {
    async findUserByExternalId(externalId) {
      const { data } = await clerk.users.getUserList({
        externalId: [externalId],
        limit: 1
      });
      return data[0] ? toWalletClerkUser(data[0]) : null;
    },

    async createWalletUser({ identityKey }) {
      try {
        const user = await clerk.users.createUser({
          // The identity key goes in externalId, which Clerk keeps unique
          // and can search, so racing first sign-ins cannot make two users
          // and a half-finished sign-in can be recovered. Migrated
          // production users hold their old dev user ID here, never a
          // 66-character hex key, so the two cannot collide.
          externalId: identityKey,
          // No email and no username: the instance has username sign-in
          // turned off, and Clerk rejects any field that is not enabled.
          // Email must be optional on the instance for this call to work.
          skipPasswordRequirement: true,
          publicMetadata: {
            bsvIdentityKey: identityKey,
            authMethod: 'wallet',
            walletLinkedAt: new Date().toISOString()
          }
        });
        return toWalletClerkUser(user);
      } catch (error) {
        if (
          isClerkAPIResponseError(error) &&
          error.errors.some(
            (e) =>
              e.code.endsWith('_exists') ||
              e.meta?.paramName === 'external_id'
          )
        ) {
          throw new UniqueViolationError('Clerk external ID already taken', {
            cause: error
          });
        }
        throw error;
      }
    },

    async createSignInToken(userId) {
      // Single use, and short: the browser exchanges it immediately.
      const token = await clerk.signInTokens.createSignInToken({
        userId,
        expiresInSeconds: 60
      });
      return token.token;
    }
  };
}

/**
 * Returns the Clerk user ID for a wallet identity key, creating the Clerk
 * user and the faucet User row on first sign-in. The row is always written
 * before this returns, so a wallet user can never reach the send route
 * without one.
 */
export async function findOrCreateWalletUser(
  identityKey: string,
  store: WalletAuthStore,
  clerk: WalletAuthClerk
): Promise<{ userId: string; isNewUser: boolean }> {
  // Two passes at most. The second pass exists for a lost race: two
  // first-time sign-ins for the same key both find nothing, both create, and
  // the loser hits a uniqueness error. Its second pass finds the winner's user.
  for (let attempt = 0; ; attempt++) {
    // 1. The faucet row is the source of truth for the mapping.
    const existingUserId = await store.findUserIdByIdentityKey(identityKey);
    if (existingUserId) return { userId: existingUserId, isNewUser: false };

    // 2. A Clerk user without a row: a crash between creating the Clerk user
    // and writing the row, or the race above. Only the backend can set
    // externalId, so a match is this wallet's account.
    const found = await clerk.findUserByExternalId(identityKey);
    const own = found?.externalId === identityKey ? found : null;

    try {
      // 3. Otherwise create the Clerk user.
      const clerkUser = own ?? (await clerk.createWalletUser({ identityKey }));

      // 4. Write the row in this request, before the ticket is returned.
      await store.upsertWalletUser({
        userId: clerkUser.id,
        identityKey,
        imageUrl: clerkUser.imageUrl
      });
      return { userId: clerkUser.id, isNewUser: !own };
    } catch (error) {
      // 5. On a uniqueness error, look again once.
      if (attempt === 0 && error instanceof UniqueViolationError) continue;
      throw error;
    }
  }
}

let cachedServerWallet: ProtoWallet | null = null;

/**
 * The faucet's own auth key, which wallets sign towards. Built lazily so a
 * missing variable fails the request that needs it, not the whole build.
 * This is a dedicated key: never the treasury key.
 */
function authPrivateKey(): PrivateKey {
  const hex = process.env.FAUCET_AUTH_PRIVATE_KEY;
  if (!hex) throw new Error('FAUCET_AUTH_PRIVATE_KEY is not set');
  return PrivateKey.fromHex(hex);
}

export function getServerWallet(): ProtoWallet {
  cachedServerWallet ??= new ProtoWallet(authPrivateKey());
  return cachedServerWallet;
}

/** Derived from the private key so a second variable cannot drift from it. */
export function getServerPublicKey(): string {
  return authPrivateKey().toPublicKey().toString();
}

export type ProofCheck =
  | { valid: true; identityKey: string }
  | { valid: false; reason: string };

/**
 * Verifies a proof's signature, expiry, action and protocol, and consumes its
 * nonce. A proof that passes cannot be used again.
 */
export async function verifyWalletProof(
  proof: unknown,
  action: string,
  deps: {
    verifier: ProofVerifierWallet;
    store: WalletAuthStore;
    now?: number;
  }
): Promise<ProofCheck> {
  // The library only checks the key is a non-empty string, so reject a
  // malformed one before spending any work on it.
  const claimedKey = (proof as AuthProof | null)?.data?.identityKey;
  if (!isIdentityKey(claimedKey)) {
    return { valid: false, reason: 'Malformed identity key' };
  }

  const result = await verifyAuthProof({
    wallet: deps.verifier,
    proof: proof as AuthProof,
    action,
    protocol: AUTH_PROTOCOL,
    consumeNonce: (nonce, expiresAt) =>
      deps.store.consumeNonce(nonce, expiresAt),
    now: deps.now
  });
  if (!result.valid || !isIdentityKey(result.identityKey)) {
    return { valid: false, reason: result.error ?? 'Invalid proof' };
  }
  return { valid: true, identityKey: result.identityKey };
}

export type WalletLoginDeps = {
  enabled: boolean;
  verifier: ProofVerifierWallet;
  store: WalletAuthStore;
  clerk: WalletAuthClerk;
  now?: () => number;
};

const json = (body: unknown, status = 200) => Response.json(body, { status });

/** POST /api/wallet-auth/login, with its dependencies injected. */
export async function handleWalletLogin(
  req: Request,
  deps: WalletLoginDeps
): Promise<Response> {
  // With the flag off the route does not exist. Hiding the tab is not
  // enough: a script could still mint accounts through the API.
  if (!deps.enabled) return json({ error: 'not_found' }, 404);

  let proof: unknown;
  try {
    ({ proof } = (await req.json()) as { proof?: unknown });
  } catch {
    return json({ error: 'invalid_request' }, 400);
  }

  // Account creation is deliberately not rate limited per IP. A new wallet
  // key costs nothing and each one gets a fresh daily limit, so the
  // per-account daily limit in the send route is the only brake on a drain.
  // A global cap, a per-address limit, a captcha and a smaller first-day
  // allowance were also considered and not built.

  const check = await verifyWalletProof(proof, LOGIN_ACTION, {
    verifier: deps.verifier,
    store: deps.store,
    now: deps.now?.()
  });
  if (!check.valid) {
    console.warn(`[wallet-auth] login proof rejected: ${check.reason}`);
    return json({ error: 'unauthenticated' }, 401);
  }
  const { identityKey } = check;
  const fingerprint = keyFingerprint(identityKey);

  // Nonce rows are useless once expired. The expiresAt index keeps this cheap,
  // and a failure here must not block the sign-in. Awaited rather than left
  // running, because a serverless function can be frozen once it responds.
  try {
    await deps.store.deleteExpiredNonces(
      new Date(deps.now?.() ?? Date.now())
    );
  } catch (error) {
    console.error('[wallet-auth] nonce cleanup failed:', error);
  }

  try {
    const { userId, isNewUser } = await findOrCreateWalletUser(
      identityKey,
      deps.store,
      deps.clerk
    );
    const ticket = await deps.clerk.createSignInToken(userId);
    if (isNewUser) {
      console.info(`[wallet-auth] created account for key ${fingerprint}…`);
    }
    return json({ ticket });
  } catch (error) {
    console.error(
      `[wallet-auth] login failed for key ${fingerprint}…:`,
      error instanceof Error ? error.message : error
    );
    return json({ error: 'wallet_auth_failed' }, 500);
  }
}

/** The production wiring for the login route. */
export async function walletLoginRoute(req: Request): Promise<Response> {
  if (!WALLET_AUTH_ENABLED) return json({ error: 'not_found' }, 404);
  let verifier: ProofVerifierWallet;
  try {
    verifier = getServerWallet();
  } catch (error) {
    console.error('[wallet-auth]', (error as Error).message);
    return json({ error: 'wallet_auth_unavailable' }, 503);
  }
  return handleWalletLogin(req, {
    enabled: WALLET_AUTH_ENABLED,
    verifier,
    store: prismaWalletAuthStore,
    clerk: await createClerkWalletAuth()
  });
}
