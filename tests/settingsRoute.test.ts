import { beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { NextRequest } from 'next/server';

// The settings route, with Clerk and the database replaced. The fake Clerk
// user keeps publicMetadata the way Clerk does: updateUser replaces the whole
// object and updateUserMetadata merges into it.
const state = vi.hoisted(() => ({
  metadata: {} as Record<string, unknown>,
  row: null as null | Record<string, unknown>,
  verifier: null as unknown,
  store: null as unknown,
  deleteUser: (async () => undefined) as (userId: string) => Promise<unknown>
}));

vi.mock('@clerk/nextjs/server', () => ({
  currentUser: async () => ({ id: 'user_1' }),
  clerkClient: async () => ({
    users: {
      updateUser: async (_: string, params: { publicMetadata?: object }) => {
        if (params.publicMetadata) state.metadata = { ...params.publicMetadata };
      },
      updateUserMetadata: async (_: string, params: { publicMetadata: object }) => {
        state.metadata = { ...state.metadata, ...params.publicMetadata };
      },
      deleteUser: (userId: string) => state.deleteUser(userId)
    }
  })
}));

vi.mock('@/prisma/generated/client/default', () => ({
  PrismaClient: class {
    user = { findUnique: async () => state.row };
  }
}));

vi.mock('@/lib/walletAuthServer', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/walletAuthServer')>();
  return {
    ...actual,
    getServerWallet: () => state.verifier,
    get prismaWalletAuthStore() {
      return state.store;
    }
  };
});

import { DELETE, PATCH, POST } from '@/app/api/settings/route';
import { DELETE_ACCOUNT_ACTION, LOGIN_ACTION } from '@/lib/walletAuth';
import {
  FakeStore,
  makeClientWallet,
  makeProof,
  makeServer
} from './helpers/walletAuthFakes';

const request = (method: string, body: unknown) =>
  new Request('http://localhost/api/settings', {
    method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body)
  }) as unknown as NextRequest;

let server: ReturnType<typeof makeServer>;
let deleteUser: Mock<(userId: string) => Promise<undefined>>;

beforeEach(() => {
  server = makeServer();
  state.verifier = server.verifier;
  state.store = new FakeStore();
  deleteUser = vi.fn(async (_userId: string) => undefined);
  state.deleteUser = deleteUser;
  state.metadata = {};
  state.row = null;
});

describe('PATCH /api/settings (theme)', () => {
  it("keeps a wallet user's bsvIdentityKey when the theme changes", async () => {
    const key = '02' + 'ab'.repeat(32);
    state.metadata = { bsvIdentityKey: key, authMethod: 'wallet', theme: 'light' };

    const res = await PATCH(request('PATCH', { theme: 'dark' }));

    expect(res.status).toBe(200);
    expect(state.metadata).toEqual({
      bsvIdentityKey: key,
      authMethod: 'wallet',
      theme: 'dark'
    });
  });
});

describe('wallet accounts in /api/settings', () => {
  const walletRow = (identityKey: string) => ({
    userId: 'user_1',
    authMethod: 'wallet',
    identityKey,
    password: ''
  });

  it('deletes the account with a fresh delete-account proof for its own key', async () => {
    const { wallet, identityKey } = await makeClientWallet();
    state.row = walletRow(identityKey);
    const proof = await makeProof(wallet, server.publicKey, {
      action: DELETE_ACCOUNT_ACTION
    });

    const res = await DELETE(request('DELETE', { proof }));

    expect(res.status).toBe(200);
    expect(deleteUser).toHaveBeenCalledWith('user_1');
  });

  it('refuses a sign-in proof, a replayed proof and another wallet', async () => {
    const { wallet, identityKey } = await makeClientWallet();
    const other = await makeClientWallet();
    state.row = walletRow(identityKey);

    const loginProof = await makeProof(wallet, server.publicKey, {
      action: LOGIN_ACTION
    });
    expect((await DELETE(request('DELETE', { proof: loginProof }))).status).toBe(401);

    const otherProof = await makeProof(other.wallet, server.publicKey, {
      action: DELETE_ACCOUNT_ACTION
    });
    expect((await DELETE(request('DELETE', { proof: otherProof }))).status).toBe(401);

    const proof = await makeProof(wallet, server.publicKey, {
      action: DELETE_ACCOUNT_ACTION
    });
    expect((await DELETE(request('DELETE', { proof }))).status).toBe(200);
    expect((await DELETE(request('DELETE', { proof }))).status).toBe(401);

    expect(deleteUser).toHaveBeenCalledTimes(1);
  });

  it('refuses a password change, since a wallet account has no password', async () => {
    state.row = walletRow('02' + 'ab'.repeat(32));

    const res = await POST(
      request('POST', { currentPassword: 'whatever1', newPassword: 'whatever2' })
    );

    expect(res.status).toBe(400);
  });

  it('leaves email accounts on the password path', async () => {
    state.row = { userId: 'user_1', authMethod: 'email', identityKey: null, password: 'not-a-hash' };

    const res = await DELETE(request('DELETE', { password: 'wrong-password' }));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe('Incorrect password');
    expect(deleteUser).not.toHaveBeenCalled();
  });
});
