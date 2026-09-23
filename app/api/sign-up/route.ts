import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = '/';
  const user = await currentUser();
  if (!user) {
    return NextResponse.redirect(url);
  }
  // Null-safe: a user with no email address gets null, never a crash. This
  // redirect is only on the email sign-up path, but it must not assume one.
  const email = user.emailAddresses[0]?.emailAddress ?? null;
  // Username sign-in is off on the Clerk instance, so new accounts have no
  // username. Use the same name and fallback as the Clerk webhook (see
  // lib/clerkUserSync.ts), so the row looks the same whichever of the two
  // writes it first. Without this the row came from the webhook alone, and
  // the send route refuses a withdrawal until it exists.
  const name =
    user.username ||
    `${user.firstName || ''}${user.lastName || ''}`.toLowerCase();
  try {
    // Upsert so a returning user (whose row was already provisioned by the
    // Clerk webhook or a prior sign-up redirect) is not duplicated or reset.
    await prisma.user.upsert({
      where: { userId: user.id },
      update: {
        ...(name ? { username: name } : {}),
        email,
        imageUrl: user.imageUrl
      },
      create: {
        userId: user.id,
        username: name || user.id,
        email,
        imageUrl: user.imageUrl,
        password: 'defaultPassword',
        role: 'user',
        theme: 'light'
      }
    });
  } catch (error) {}
  return NextResponse.redirect(url);
}

export const dynamic = 'force-dynamic';
