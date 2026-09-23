import { describe, expect, it } from 'vitest';
import { handleWalletLogin } from '@/lib/walletAuthServer';
import {
  signInWithWallet,
  type WalletSignInClerk
} from '@/lib/walletSignInFlow';
import {
  FakeClerk,
  FakeStore,
  makeClientWallet,
  makeServer
} from './helpers/walletAuthFakes';

/**
 * The browser side of the sign-in flow, run end to end against the real
 * login handler with the fakes behind it. The wallet is a ProtoWallet, which
 * has the same signing interface as the relay's wallet proxy for a phone and
 * as WalletClient for a wallet on this computer, so one test covers both.
 */
function setup(overrides: { loginStatus?: number } = {}) {
  const server = makeServer();
  const store = new FakeStore();
  const clerkBackend = new FakeClerk();

  const fetchImpl: typeof fetch = async (input, init) => {
    const url =
      typeof input === 'string'
        ? input
        : input instanceof URL
          ? input.href
          : input.url;
    if (url === '/api/wallet-auth/server-key') {
      return Response.json({ publicKey: server.publicKey });
    }
    if (url === '/api/wallet-auth/login') {
      if (overrides.loginStatus) {
        return Response.json(
          { error: 'nope' },
          { status: overrides.loginStatus }
        );
      }
      return handleWalletLogin(
        new Request('http://localhost/api/wallet-auth/login', init),
        {
          enabled: true,
          verifier: server.verifier,
          store,
          clerk: clerkBackend
        }
      );
    }
    throw new Error(`unexpected fetch ${url}`);
  };

  const tickets: string[] = [];
  const activated: string[] = [];
  const clerk: WalletSignInClerk = {
    signIn: {
      async create({ ticket }) {
        tickets.push(ticket);
        return {
          status: 'complete',
          createdSessionId: `sess_${tickets.length}`
        };
      }
    },
    async setActive({ session }) {
      activated.push(session);
    }
  };

  return { store, clerkBackend, fetchImpl, clerk, tickets, activated };
}

describe('signInWithWallet', () => {
  it('signs a proof, exchanges it for a ticket and activates the session', async () => {
    const { store, clerkBackend, fetchImpl, clerk, tickets, activated } =
      setup();
    const { wallet, identityKey } = await makeClientWallet();
    const phases: string[] = [];

    const outcome = await signInWithWallet({
      wallet,
      clerk,
      fetchImpl,
      onVerifying: () => phases.push('verifying')
    });

    expect(outcome).toBe('done');
    expect(phases).toEqual(['verifying']);
    expect(clerkBackend.users).toHaveLength(1);
    expect(tickets).toEqual([`ticket_for_${clerkBackend.users[0].id}`]);
    expect(activated).toEqual(['sess_1']);
    const rows = Array.from(store.rows.values());
    expect(rows).toHaveLength(1);
    expect(rows[0].identityKey).toBe(identityKey);
  });

  it('stops quietly when the caller has given up, without touching Clerk', async () => {
    const { clerkBackend, fetchImpl, clerk, tickets } = setup();
    const { wallet } = await makeClientWallet();
    let calls = 0;
    // The first check is right after the wallet answers; give up there, as a
    // prompt timeout that fired while the wallet was open would.
    const abandoned = () => ++calls >= 1;

    const outcome = await signInWithWallet({
      wallet,
      clerk,
      fetchImpl,
      abandoned
    });

    expect(outcome).toBe('abandoned');
    expect(tickets).toEqual([]);
    expect(clerkBackend.users).toHaveLength(0);
  });

  it('throws when the login route rejects the proof', async () => {
    const { fetchImpl, clerk, tickets } = setup({ loginStatus: 401 });
    const { wallet } = await makeClientWallet();

    await expect(
      signInWithWallet({ wallet, clerk, fetchImpl })
    ).rejects.toThrow('wallet-login 401');
    expect(tickets).toEqual([]);
  });

  it('throws when Clerk does not complete the ticket sign-in', async () => {
    const { fetchImpl } = setup();
    const { wallet } = await makeClientWallet();
    const clerk: WalletSignInClerk = {
      signIn: {
        async create() {
          return { status: 'needs_second_factor', createdSessionId: null };
        }
      },
      async setActive() {}
    };

    await expect(
      signInWithWallet({ wallet, clerk, fetchImpl })
    ).rejects.toThrow('ticket sign-in ended as needs_second_factor');
  });
});
