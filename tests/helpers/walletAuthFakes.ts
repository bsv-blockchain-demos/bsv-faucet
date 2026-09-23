import { createAuthProof } from '@bsv/auth';
import { PrivateKey, ProtoWallet, type WalletProtocol } from '@bsv/sdk';
import {
  UniqueViolationError,
  UsernameTakenError,
  type WalletAuthClerk,
  type WalletAuthStore,
  type WalletClerkUser
} from '@/lib/walletAuthServer';
import { AUTH_PROTOCOL, LOGIN_ACTION, walletUsername } from '@/lib/walletAuth';

// Yield to the event loop so concurrent calls interleave the way they would
// against a real database and a real Clerk, instead of running back to back.
const tick = () => new Promise((resolve) => setTimeout(resolve, 0));

export type FakeRow = {
  userId: string;
  username: string;
  identityKey: string | null;
  authMethod: 'email' | 'wallet';
  email: string | null;
};

/** In-memory WalletAuthStore with the same unique rules as the real schema. */
export class FakeStore implements WalletAuthStore {
  nonces = new Map<string, Date>();
  rows = new Map<string, FakeRow>();

  async consumeNonce(nonce: string, expiresAt: Date) {
    // Checked and written with no await in between, so it is atomic here in
    // the same way the database's primary key makes it atomic in production.
    if (this.nonces.has(nonce)) return false;
    this.nonces.set(nonce, expiresAt);
    await tick();
    return true;
  }

  async deleteExpiredNonces(now: Date) {
    for (const [nonce, expiresAt] of Array.from(this.nonces)) {
      if (expiresAt < now) this.nonces.delete(nonce);
    }
  }

  async findUserIdByIdentityKey(identityKey: string) {
    await tick();
    for (const row of Array.from(this.rows.values())) {
      if (row.identityKey === identityKey) return row.userId;
    }
    return null;
  }

  async upsertWalletUser(user: {
    userId: string;
    identityKey: string;
    imageUrl: string;
  }) {
    await tick();
    const others = Array.from(this.rows.values()).filter(
      (row) => row.userId !== user.userId
    );
    if (others.some((row) => row.identityKey === user.identityKey)) {
      throw new UniqueViolationError('duplicate identity key');
    }
    const existing = this.rows.get(user.userId);
    // Same rule as the Prisma store: the short name, or the long one when
    // another row already holds the short one.
    const username =
      existing?.username ??
      [walletUsername(user.identityKey, 'short'), walletUsername(user.identityKey, 'long')].find(
        (name) => !others.some((row) => row.username === name)
      );
    if (!username) throw new UniqueViolationError('duplicate username');
    this.rows.set(user.userId, {
      userId: user.userId,
      username,
      email: existing?.email ?? null,
      identityKey: user.identityKey,
      authMethod: 'wallet'
    });
  }

  /** A row written some other way, for example an email account. */
  addRow(row: Partial<FakeRow> & { userId: string; username: string }) {
    this.rows.set(row.userId, {
      identityKey: null,
      authMethod: 'email',
      email: null,
      ...row
    });
  }
}

/** In-memory Clerk with unique external IDs and usernames, like the real one. */
export class FakeClerk implements WalletAuthClerk {
  users: WalletClerkUser[] = [];
  createCalls = 0;
  tokens: string[] = [];
  private nextId = 1;

  async findUserByExternalId(externalId: string) {
    await tick();
    return this.users.find((u) => u.externalId === externalId) ?? null;
  }

  async getUser(userId: string) {
    await tick();
    const user = this.users.find((u) => u.id === userId);
    if (!user) throw new Error(`no Clerk user ${userId}`);
    return user;
  }

  async createWalletUser({
    identityKey,
    username
  }: {
    identityKey: string;
    username: string;
  }) {
    this.createCalls++;
    await tick();
    if (this.users.some((u) => u.externalId === identityKey)) {
      throw new UniqueViolationError('external_id_exists');
    }
    if (this.users.some((u) => u.username === username)) {
      throw new UsernameTakenError(username);
    }
    const user: WalletClerkUser = {
      id: `user_fake_${this.nextId++}`,
      imageUrl: 'https://img.clerk.com/placeholder',
      externalId: identityKey,
      username
    };
    this.users.push(user);
    return user;
  }

  async setUsername(userId: string, username: string) {
    await tick();
    if (this.users.some((u) => u.username === username && u.id !== userId)) {
      throw new UsernameTakenError(username);
    }
    (await this.getUser(userId)).username = username;
  }

  /**
   * An account made some other way: a migrated email user, or a wallet
   * account created before wallet accounts were given a username.
   */
  addUser(user: Partial<WalletClerkUser>) {
    const created: WalletClerkUser = {
      id: `user_fake_${this.nextId++}`,
      imageUrl: 'https://img.clerk.com/placeholder',
      externalId: null,
      username: null,
      ...user
    };
    this.users.push(created);
    return created;
  }

  async createSignInToken(userId: string) {
    // Real Clerk issues the token anyway and fails later, in the browser's
    // ticket exchange. Failing here instead makes every login test check
    // that a ticket only goes to an account Clerk can sign in.
    if (!this.users.find((u) => u.id === userId)?.username) {
      throw new Error(
        "The given token doesn't have an associated identification for the user who created it."
      );
    }
    const token = `ticket_for_${userId}`;
    this.tokens.push(token);
    return token;
  }
}

/** The faucet's side: an auth key and a verifier wallet built from it. */
export function makeServer() {
  const key = PrivateKey.fromRandom();
  return {
    verifier: new ProtoWallet(key),
    publicKey: key.toPublicKey().toString()
  };
}

/** A user's wallet. No real wallet is needed: ProtoWallet signs the same way. */
export async function makeClientWallet() {
  const wallet = new ProtoWallet(PrivateKey.fromRandom());
  const { publicKey } = await wallet.getPublicKey({ identityKey: true });
  return { wallet, identityKey: publicKey };
}

export function makeProof(
  wallet: ProtoWallet,
  counterparty: string,
  options: { action?: string; protocol?: WalletProtocol } = {}
) {
  return createAuthProof({
    wallet,
    counterparty,
    action: options.action ?? LOGIN_ACTION,
    protocol: options.protocol ?? AUTH_PROTOCOL
  });
}

export function loginRequest(body: unknown) {
  return new Request('http://localhost/api/wallet-auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: typeof body === 'string' ? body : JSON.stringify(body)
  });
}
