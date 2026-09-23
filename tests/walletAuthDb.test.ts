import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserJSON } from '@clerk/nextjs/server';

// Runs before every import below. lib/prisma builds its client, and reads
// POSTGRES_PRISMA_URL, the moment it is first imported. vitest does not load
// .env.local, so without this the variable is simply unset.
vi.hoisted(() => {
  const testUrl = process.env.TEST_DATABASE_URL;
  if (testUrl && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(testUrl)) {
    process.env.POSTGRES_PRISMA_URL = testUrl;
  }
});

import {
  FakeClerk,
  loginRequest,
  makeClientWallet,
  makeProof,
  makeServer
} from './helpers/walletAuthFakes';

// Integration tests against a real Postgres, for the parts an in-memory fake
// cannot prove: the nonce insert is atomic, NULL emails coexist under the
// unique constraint, and the webhook and login route converge on one row.
//
// Opt in with a throwaway database that has the migrations applied:
//   TEST_DATABASE_URL=postgresql://postgres:postgres@127.0.0.1:5439/faucet pnpm test
// These tests delete rows, so they refuse to run against anything but
// localhost.
const url = process.env.TEST_DATABASE_URL;
const isLocal = !!url && /@(localhost|127\.0\.0\.1)(:\d+)?\//.test(url);
if (url && !isLocal) {
  throw new Error('TEST_DATABASE_URL must point at a local database.');
}

type Modules = {
  prisma: typeof import('@/lib/prisma').prisma;
  server: typeof import('@/lib/walletAuthServer');
  sync: typeof import('@/lib/clerkUserSync');
};

describe.skipIf(!isLocal)('wallet sign-in against Postgres', () => {
  let m: Modules;

  beforeAll(async () => {
    m = {
      prisma: (await import('@/lib/prisma')).prisma,
      server: await import('@/lib/walletAuthServer'),
      sync: await import('@/lib/clerkUserSync')
    };
  });

  beforeEach(async () => {
    await m.prisma.authNonce.deleteMany();
    await m.prisma.user.deleteMany({ where: { userId: { startsWith: 'user_fake_' } } });
  });

  afterAll(async () => {
    await m?.prisma.$disconnect();
  });

  const login = (
    server: ReturnType<typeof makeServer>,
    clerk: FakeClerk,
    proof: unknown
  ) =>
    m.server.handleWalletLogin(loginRequest({ proof }), {
      enabled: true,
      verifier: server.verifier,
      store: m.server.prismaWalletAuthStore,
      clerk
    });

  /** The payload Clerk sends for a user the login route created. */
  const clerkUserJSON = (
    user: { id: string; username?: string | null },
    identityKey: string | null
  ) =>
    ({
      id: user.id,
      username: user.username ?? null,
      external_id: identityKey,
      first_name: null,
      last_name: null,
      image_url: 'https://img.clerk.com/placeholder',
      email_addresses: [],
      public_metadata: identityKey
        ? { bsvIdentityKey: identityKey, authMethod: 'wallet' }
        : {}
    }) as unknown as UserJSON;

  const rowFor = (userId: string) =>
    m.prisma.user.findUnique({
      where: { userId },
      select: {
        userId: true,
        username: true,
        email: true,
        identityKey: true,
        authMethod: true,
        role: true,
        withdrawn: true,
        paused: true
      }
    });

  it('accepts a nonce exactly once under concurrency', async () => {
    const expiresAt = new Date(Date.now() + 60_000);
    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        m.server.prismaWalletAuthStore.consumeNonce('same-nonce', expiresAt)
      )
    );
    expect(results.filter(Boolean)).toHaveLength(1);
  });

  it('writes the row with identityKey, authMethod wallet and a null email', async () => {
    const server = makeServer();
    const clerk = new FakeClerk();
    const a = await makeClientWallet();
    const b = await makeClientWallet();

    // Two wallet users, both with no email: NULL does not trip the unique
    // constraint the way '' did.
    expect((await login(server, clerk, await makeProof(a.wallet, server.publicKey))).status).toBe(200);
    expect((await login(server, clerk, await makeProof(b.wallet, server.publicKey))).status).toBe(200);

    const rows = await m.prisma.user.findMany({
      where: { userId: { startsWith: 'user_fake_' } },
      orderBy: { id: 'asc' }
    });
    expect(rows.map((r) => [r.identityKey, r.authMethod, r.email])).toEqual([
      [a.identityKey, 'wallet', null],
      [b.identityKey, 'wallet', null]
    ]);
  });

  it('rejects a replayed proof using the real nonce table', async () => {
    const server = makeServer();
    const clerk = new FakeClerk();
    const { wallet } = await makeClientWallet();
    const proof = await makeProof(wallet, server.publicKey);

    expect((await login(server, clerk, proof)).status).toBe(200);
    expect((await login(server, clerk, proof)).status).toBe(401);
  });

  it('ends two racing first sign-ins with one row', async () => {
    const server = makeServer();
    const clerk = new FakeClerk();
    const { wallet } = await makeClientWallet();
    const [p1, p2] = await Promise.all([
      makeProof(wallet, server.publicKey),
      makeProof(wallet, server.publicKey)
    ]);

    const [r1, r2] = await Promise.all([login(server, clerk, p1), login(server, clerk, p2)]);

    expect([r1.status, r2.status]).toEqual([200, 200]);
    expect(clerk.users).toHaveLength(1);
    expect(await m.prisma.user.count({ where: { userId: { startsWith: 'user_fake_' } } })).toBe(1);
  });

  it('ends with the same row whether the webhook lands before or after the login route', async () => {
    const results = [];
    for (const order of ['webhook-first', 'login-first'] as const) {
      await m.prisma.user.deleteMany({ where: { userId: { startsWith: 'user_fake_' } } });
      const server = makeServer();
      const clerk = new FakeClerk();
      const { wallet, identityKey } = await makeClientWallet();

      let userId: string;
      if (order === 'webhook-first') {
        // The Clerk user exists and its user.created event is processed
        // before the login route writes the row.
        const user = await clerk.createWalletUser({
          identityKey,
          username: 'bsv_' + identityKey.slice(2, 18)
        });
        userId = user.id;
        await m.sync.upsertUserFromClerk('user.created', clerkUserJSON(user, identityKey));
        expect((await login(server, clerk, await makeProof(wallet, server.publicKey))).status).toBe(200);
      } else {
        expect((await login(server, clerk, await makeProof(wallet, server.publicKey))).status).toBe(200);
        const user = clerk.users[0];
        userId = user.id;
        await m.sync.upsertUserFromClerk('user.created', clerkUserJSON(user, identityKey));
      }

      const row = await rowFor(userId);
      expect(row).toMatchObject({
        userId,
        email: null,
        identityKey,
        authMethod: 'wallet',
        role: 'user',
        paused: false
      });
      // Both writers generate the same username, so it is compared too.
      expect(row?.username).toBe('bsv_' + identityKey.slice(2, 18));
      results.push({ ...row, userId: undefined, identityKey: undefined, username: undefined });
    }
    expect(results[0]).toEqual(results[1]);
  });

  it('never clears an existing identityKey from a webhook without the metadata', async () => {
    const server = makeServer();
    const clerk = new FakeClerk();
    const { wallet, identityKey } = await makeClientWallet();
    expect((await login(server, clerk, await makeProof(wallet, server.publicKey))).status).toBe(200);
    const user = clerk.users[0];

    // A user.updated whose metadata no longer has the key, for example after
    // an old theme toggle replaced the whole publicMetadata object.
    await m.sync.upsertUserFromClerk('user.updated', clerkUserJSON(user, null));

    expect(await rowFor(user.id)).toMatchObject({ identityKey, authMethod: 'wallet' });
  });

  it('writes null, not an empty string, for email users with no email', async () => {
    for (const id of ['user_fake_email_a', 'user_fake_email_b']) {
      await m.sync.upsertUserFromClerk('user.created', {
        ...clerkUserJSON({ id, username: id }, null)
      });
    }
    const rows = await m.prisma.user.findMany({
      where: { userId: { startsWith: 'user_fake_email_' } }
    });
    expect(rows.map((r) => [r.email, r.authMethod, r.identityKey])).toEqual([
      [null, 'email', null],
      [null, 'email', null]
    ]);
  });
  it('falls back to the long username on a real unique conflict', async () => {
    const server = makeServer();
    const clerk = new FakeClerk();
    const { wallet, identityKey } = await makeClientWallet();
    await m.prisma.user.create({
      data: {
        userId: 'user_fake_email_squat',
        username: 'bsv_' + identityKey.slice(2, 18),
        role: 'user',
        password: 'x'
      }
    });

    expect((await login(server, clerk, await makeProof(wallet, server.publicKey))).status).toBe(200);

    expect(await rowFor(clerk.users[0].id)).toMatchObject({
      username: 'bsv_' + identityKey.slice(2, 34),
      identityKey
    });
  });

  it('never blanks the username when an account without one is updated', async () => {
    // Two email accounts with no username and no name: the second update
    // used to write '' again and fail the unique constraint.
    for (const id of ['user_fake_nameless_a', 'user_fake_nameless_b']) {
      await m.sync.upsertUserFromClerk('user.created', clerkUserJSON({ id }, null));
      await m.sync.upsertUserFromClerk('user.updated', clerkUserJSON({ id }, null));
    }
    const rows = await m.prisma.user.findMany({
      where: { userId: { startsWith: 'user_fake_nameless_' } },
      orderBy: { userId: 'asc' }
    });
    expect(rows.map((r) => r.username)).toEqual([
      'user_fake_nameless_a',
      'user_fake_nameless_b'
    ]);
  });

  it('falls back to the user ID when an email account name is taken', async () => {
    for (const id of ['user_fake_named_a', 'user_fake_named_b']) {
      await m.sync.upsertUserFromClerk('user.created', {
        ...clerkUserJSON({ id }, null),
        first_name: 'Sam',
        last_name: 'Lee'
      } as UserJSON);
    }
    const rows = await m.prisma.user.findMany({
      where: { userId: { startsWith: 'user_fake_named_' } },
      orderBy: { userId: 'asc' }
    });
    expect(rows.map((r) => r.username)).toEqual(['samlee', 'user_fake_named_b']);
  });
});
