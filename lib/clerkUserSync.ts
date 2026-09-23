import type { UserJSON } from '@clerk/nextjs/server';
import { Prisma, type PrismaClient } from '@/prisma/generated/client';
import { prisma as defaultPrisma } from '@/lib/prisma';
import { isIdentityKey, walletUsername } from '@/lib/walletAuth';

// Profile sync from the Clerk webhook, kept out of the route file so tests can
// run it against a real database alongside the wallet login route's write.

/**
 * Null when the user has no email, never ''. Wallet accounts have none, and a
 * second '' would fail the unique constraint on User.email.
 */
export function emailFromClerk(userData: UserJSON): string | null {
  return userData.email_addresses[0]?.email_address || null;
}

/**
 * The wallet fields a Clerk user carries in publicMetadata, which only the
 * backend can write, so they are safe to trust. Returns nothing for an email
 * account, so spreading the result into an update never clears an existing
 * identityKey and never downgrades authMethod.
 */
export function walletFieldsFromClerk(
  userData: UserJSON
): { identityKey: string; authMethod: 'wallet' } | Record<string, never> {
  const metadata = (userData.public_metadata ?? {}) as Record<string, unknown>;
  const identityKey = metadata.bsvIdentityKey;
  if (metadata.authMethod === 'wallet' && isIdentityKey(identityKey)) {
    return { identityKey, authMethod: 'wallet' };
  }
  return {};
}

/** The name Clerk gives a user, if any. Empty for accounts with neither. */
function clerkName(userData: UserJSON): string {
  return (
    userData.username ||
    `${userData.first_name || ''}${userData.last_name || ''}`.toLowerCase()
  );
}

function isUsernameConflict(error: unknown): boolean {
  return (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2002' &&
    JSON.stringify(error.meta?.target ?? '').includes('username')
  );
}

/**
 * Upsert keyed on userId for user.created and user.updated. A replayed event,
 * an update that arrives before the row exists, or a row the wallet login
 * route already wrote all end in the same row. Only profile fields are
 * refreshed, so rate-limit state (role, withdrawn, paused, lastActive) is
 * never reset.
 */
export async function upsertUserFromClerk(
  eventType: 'user.created' | 'user.updated',
  userData: UserJSON,
  prisma: Pick<PrismaClient, 'user'> = defaultPrisma
): Promise<void> {
  const email = emailFromClerk(userData);
  const walletFields = walletFieldsFromClerk(userData);
  const name = clerkName(userData);

  // A new row needs a unique username, and most email accounts have none in
  // Clerk. Wallet accounts carry the generated name the login route gives
  // them (older ones may not yet), with its long form as the fallback, so the
  // row looks the same whichever of the two writes it first. Other accounts fall
  // back to the full Clerk user ID, which is unique, also when their name is
  // already taken. The first 8 characters of the ID used to be the fallback,
  // but that is "user_" plus 3 characters, which collides after a few dozen
  // accounts now that most have no username.
  const usernameCandidates = walletFields.identityKey
    ? [
        name || walletUsername(walletFields.identityKey, 'short'),
        walletUsername(walletFields.identityKey, 'long')
      ]
    : name
      ? [name, userData.id]
      : [userData.id];

  for (let i = 0; i < usernameCandidates.length; i++) {
    try {
      await prisma.user.upsert({
        where: { userId: userData.id },
        update: {
          // Only when Clerk has one. Writing '' here broke the second
          // account without a username, on the unique constraint.
          ...(name ? { username: name } : {}),
          email,
          imageUrl: userData.image_url,
          ...walletFields
        },
        create: {
          userId: userData.id,
          username: usernameCandidates[i],
          email,
          imageUrl: userData.image_url,
          role: 'user',
          theme: 'light',
          password: 'defaultPassword123', // Replace with a more secure approach if necessary
          ...walletFields
        }
      });
      return;
    } catch (error) {
      if (isUsernameConflict(error) && i < usernameCandidates.length - 1) {
        continue;
      }
      throw error;
    }
  }
}
