import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

// The redirect after email sign-up, with Clerk and the database replaced.
const mocks = vi.hoisted(() => ({ currentUser: vi.fn(), upsert: vi.fn() }));

vi.mock('@clerk/nextjs/server', () => ({ currentUser: mocks.currentUser }));
vi.mock('@/lib/prisma', () => ({ prisma: { user: { upsert: mocks.upsert } } }));

import { GET } from '@/app/api/sign-up/route';

const signUpRedirect = () =>
  GET(new NextRequest('http://localhost/api/sign-up'));

const clerkUser = (overrides: Record<string, unknown> = {}) => ({
  id: 'user_2abcDEFghiJKL',
  username: null,
  firstName: null,
  lastName: null,
  imageUrl: 'https://img.clerk.com/placeholder',
  emailAddresses: [{ emailAddress: 'a@example.com' }],
  ...overrides
});

beforeEach(() => {
  vi.resetAllMocks();
  mocks.upsert.mockResolvedValue({});
});

describe('GET /api/sign-up', () => {
  it('writes the row for an account with no username, named by its user ID', async () => {
    mocks.currentUser.mockResolvedValue(clerkUser());

    const res = await signUpRedirect();

    expect(res.status).toBe(307);
    expect(mocks.upsert).toHaveBeenCalledTimes(1);
    const { update, create } = mocks.upsert.mock.calls[0][0];
    expect(create).toMatchObject({
      userId: 'user_2abcDEFghiJKL',
      username: 'user_2abcDEFghiJKL',
      email: 'a@example.com'
    });
    // A returning user keeps whatever username their row already has.
    expect(update).not.toHaveProperty('username');
  });

  it('writes null for an account with no email', async () => {
    mocks.currentUser.mockResolvedValue(clerkUser({ emailAddresses: [] }));

    await signUpRedirect();

    expect(mocks.upsert.mock.calls[0][0].create.email).toBeNull();
  });

  it('writes nothing when signed out', async () => {
    mocks.currentUser.mockResolvedValue(null);

    await signUpRedirect();

    expect(mocks.upsert).not.toHaveBeenCalled();
  });
});
