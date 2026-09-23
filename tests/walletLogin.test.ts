import { describe, expect, it } from 'vitest';
import { handleWalletLogin } from '@/lib/walletAuthServer';
import { DELETE_ACCOUNT_ACTION, walletUsername } from '@/lib/walletAuth';
import {
  FakeClerk,
  FakeStore,
  loginRequest,
  makeClientWallet,
  makeProof,
  makeServer
} from './helpers/walletAuthFakes';

function setup(overrides: { enabled?: boolean; now?: () => number } = {}) {
  const server = makeServer();
  const store = new FakeStore();
  const clerk = new FakeClerk();
  const login = (body: unknown) =>
    handleWalletLogin(loginRequest(body), {
      enabled: overrides.enabled ?? true,
      verifier: server.verifier,
      store,
      clerk,
      now: overrides.now
    });
  return { server, store, clerk, login };
}

describe('POST /api/wallet-auth/login', () => {
  it('signs in a first-time wallet: one Clerk user, one row, a ticket', async () => {
    const { server, store, clerk, login } = setup();
    const { wallet, identityKey } = await makeClientWallet();

    const res = await login({ proof: await makeProof(wallet, server.publicKey) });

    expect(res.status).toBe(200);
    const { ticket } = await res.json();
    expect(clerk.users).toHaveLength(1);
    const [clerkUser] = clerk.users;
    expect(ticket).toBe(`ticket_for_${clerkUser.id}`);
    // Clerk holds the key in externalId and no username at all.
    expect(clerkUser.externalId).toBe(identityKey);
    expect(clerkUser).not.toHaveProperty('username');

    expect(Array.from(store.rows.values())).toEqual([
      {
        userId: clerkUser.id,
        username: walletUsername(identityKey),
        identityKey,
        authMethod: 'wallet',
        email: null
      }
    ]);
  });

  it('reuses the same Clerk user and row for a returning wallet', async () => {
    const { server, store, clerk, login } = setup();
    const { wallet } = await makeClientWallet();

    const first = await login({ proof: await makeProof(wallet, server.publicKey) });
    const second = await login({ proof: await makeProof(wallet, server.publicKey) });

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect((await second.json()).ticket).toBe((await first.json()).ticket);
    expect(clerk.createCalls).toBe(1);
    expect(clerk.users).toHaveLength(1);
    expect(store.rows.size).toBe(1);
  });

  it('rejects a replayed proof with 401', async () => {
    const { server, clerk, login } = setup();
    const { wallet } = await makeClientWallet();
    const proof = await makeProof(wallet, server.publicKey);

    expect((await login({ proof })).status).toBe(200);
    const replay = await login({ proof });

    expect(replay.status).toBe(401);
    expect(clerk.tokens).toHaveLength(1);
  });

  it('rejects an expired proof with 401 and does not consume its nonce', async () => {
    const { server, store, clerk } = setup();
    const { wallet } = await makeClientWallet();
    const proof = await makeProof(wallet, server.publicKey);

    const res = await handleWalletLogin(loginRequest({ proof }), {
      enabled: true,
      verifier: server.verifier,
      store,
      clerk,
      now: () => proof.data.expiresAt + 1
    });

    expect(res.status).toBe(401);
    expect(store.nonces.size).toBe(0);
    expect(clerk.users).toHaveLength(0);
  });

  it('rejects a proof for the wrong action with 401', async () => {
    const { server, clerk, login } = setup();
    const { wallet } = await makeClientWallet();
    const proof = await makeProof(wallet, server.publicKey, {
      action: DELETE_ACCOUNT_ACTION
    });

    expect((await login({ proof })).status).toBe(401);
    expect(clerk.users).toHaveLength(0);
  });

  it('rejects a proof made with the wrong protocol with 401', async () => {
    const { server, clerk, login } = setup();
    const { wallet } = await makeClientWallet();
    const proof = await makeProof(wallet, server.publicKey, {
      protocol: [2, 'some other app login']
    });

    expect((await login({ proof })).status).toBe(401);
    expect(clerk.users).toHaveLength(0);
  });

  it('rejects a proof signed towards a different server key with 401', async () => {
    const { clerk, login } = setup();
    const otherServer = makeServer();
    const { wallet } = await makeClientWallet();
    const proof = await makeProof(wallet, otherServer.publicKey);

    expect((await login({ proof })).status).toBe(401);
    expect(clerk.users).toHaveLength(0);
  });

  it.each([
    ['not hex', 'zz'.repeat(33)],
    ['uncompressed prefix', '04' + 'ab'.repeat(32)],
    ['too short', '02' + 'ab'.repeat(20)],
    ['upper case', '02' + 'AB'.repeat(32)],
    ['not a string', 12345]
  ])('rejects a malformed identity key (%s) with 401', async (_, badKey) => {
    const { server, store, clerk, login } = setup();
    const { wallet } = await makeClientWallet();
    const proof = await makeProof(wallet, server.publicKey);
    const tampered = { ...proof, data: { ...proof.data, identityKey: badKey } };

    expect((await login({ proof: tampered })).status).toBe(401);
    expect(store.nonces.size).toBe(0);
    expect(clerk.users).toHaveLength(0);
  });

  it('rejects a correctly signed proof whose key is not in canonical form', async () => {
    // A wallet that reports its key in upper case signs a proof that really
    // does verify, because hex parsing ignores case. Only the format check
    // stops the same wallet getting a second account under a second key.
    const { server, clerk, login } = setup();
    const { wallet } = await makeClientWallet();
    const shouting = {
      getPublicKey: async (args: { identityKey: true }) => {
        const { publicKey } = await wallet.getPublicKey(args);
        return { publicKey: publicKey.toUpperCase() };
      },
      createSignature: wallet.createSignature.bind(wallet)
    };
    const proof = await makeProof(shouting as never, server.publicKey);

    expect((await login({ proof })).status).toBe(401);
    expect(clerk.users).toHaveLength(0);
  });

  it("rejects a proof claiming someone else's valid key with 401", async () => {
    const { server, clerk, login } = setup();
    const { wallet } = await makeClientWallet();
    const victim = await makeClientWallet();
    const proof = await makeProof(wallet, server.publicKey);
    const forged = {
      ...proof,
      data: { ...proof.data, identityKey: victim.identityKey }
    };

    expect((await login({ proof: forged })).status).toBe(401);
    expect(clerk.users).toHaveLength(0);
  });

  it('rejects a missing proof and a body that is not JSON', async () => {
    const { login } = setup();
    expect((await login({})).status).toBe(401);
    expect((await login('not json')).status).toBe(400);
  });

  it('does not exist while the flag is off', async () => {
    const { server, store, clerk, login } = setup({ enabled: false });
    const { wallet } = await makeClientWallet();

    const res = await login({ proof: await makeProof(wallet, server.publicKey) });

    expect(res.status).toBe(404);
    expect(store.nonces.size).toBe(0);
    expect(clerk.users).toHaveLength(0);
  });

  it('ends two racing first sign-ins for one key with one Clerk user and one row', async () => {
    const { server, store, clerk, login } = setup();
    const { wallet, identityKey } = await makeClientWallet();
    const [proofA, proofB] = await Promise.all([
      makeProof(wallet, server.publicKey),
      makeProof(wallet, server.publicKey)
    ]);

    const [a, b] = await Promise.all([login({ proof: proofA }), login({ proof: proofB })]);

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    // Both creates really did race: the loser recovered on its second pass.
    expect(clerk.createCalls).toBe(2);
    expect(clerk.users).toHaveLength(1);
    expect(store.rows.size).toBe(1);
    expect(Array.from(store.rows.values())[0].identityKey).toBe(identityKey);
    expect((await a.json()).ticket).toBe((await b.json()).ticket);
  });

  it('recovers a Clerk user whose row was never written', async () => {
    const { server, store, clerk, login } = setup();
    const { wallet, identityKey } = await makeClientWallet();
    const orphan = clerk.addUser({ externalId: identityKey });

    const res = await login({ proof: await makeProof(wallet, server.publicKey) });

    expect(res.status).toBe(200);
    expect(clerk.createCalls).toBe(0);
    expect(store.rows.get(orphan.id)?.identityKey).toBe(identityKey);
  });

  it('falls back to the long username when another row holds the short one', async () => {
    const { server, store, clerk, login } = setup();
    const { wallet, identityKey } = await makeClientWallet();
    // An email account that once chose this wallet's short name, back when
    // usernames were enabled.
    store.addRow({ userId: 'user_email_1', username: walletUsername(identityKey) });

    const res = await login({ proof: await makeProof(wallet, server.publicKey) });

    expect(res.status).toBe(200);
    const walletUser = clerk.users.find((u) => u.externalId === identityKey)!;
    expect(store.rows.get(walletUser.id)?.username).toBe(
      walletUsername(identityKey, 'long')
    );
    expect(store.rows.get(walletUser.id)?.username).toMatch(/^bsv_[0-9a-f]{32}$/);
    expect(store.rows.get('user_email_1')?.identityKey).toBeNull();
  });

  it('never treats a Clerk user with a different external ID as the wallet', async () => {
    const { server, store, clerk, login } = setup();
    const { wallet, identityKey } = await makeClientWallet();
    // A migrated production user: externalId holds an old dev user ID.
    const migrated = clerk.addUser({ externalId: 'user_2devOldId' });

    const res = await login({ proof: await makeProof(wallet, server.publicKey) });

    expect(res.status).toBe(200);
    expect(clerk.users).toHaveLength(2);
    expect(store.rows.get(migrated.id)).toBeUndefined();
    expect(clerk.users[1].externalId).toBe(identityKey);
  });

  it('deletes expired nonces as it goes', async () => {
    const { server, store, login } = setup();
    store.nonces.set('old', new Date(Date.now() - 60_000));
    const { wallet } = await makeClientWallet();

    await login({ proof: await makeProof(wallet, server.publicKey) });

    expect(store.nonces.has('old')).toBe(false);
    expect(store.nonces.size).toBe(1);
  });
});
