import { NextRequest, NextResponse } from 'next/server';
import { currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = '/';
  const user = await currentUser();
  if (!user || !user.username) {
    return NextResponse.redirect(url);
  }
  try {
    // Upsert so a returning user (whose row was already provisioned by the
    // Clerk webhook or a prior sign-up redirect) is not duplicated or reset.
    await prisma.user.upsert({
      where: { userId: user.id },
      update: {
        username: user.username,
        email: user.emailAddresses[0].emailAddress,
        imageUrl: user.imageUrl
      },
      create: {
        userId: user.id,
        username: user.username,
        email: user.emailAddresses[0].emailAddress,
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
