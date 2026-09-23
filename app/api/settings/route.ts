import { NextResponse, NextRequest } from 'next/server';
import { currentUser, clerkClient } from '@clerk/nextjs/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { PrismaClient } from '@/prisma/generated/client/default';
import { DELETE_ACCOUNT_ACTION } from '@/lib/walletAuth';
import {
  getServerWallet,
  prismaWalletAuthStore,
  verifyWalletProof
} from '@/lib/walletAuthServer';

const prisma = new PrismaClient();

// Input validation schemas
const UpdateUserSchema = z.object({
  username: z.string().min(3).max(255).optional(),
  email: z.string().email().optional()
});

const UpdateThemeSchema = z.object({
  theme: z.enum(['light', 'dark'])
});

const ChangePasswordSchema = z.object({
  currentPassword: z.string().min(8),
  newPassword: z.string().min(8)
});

const DeleteAccountSchema = z.object({
  password: z.string().min(8)
});

// A wallet account has no password, so it confirms deletion with a fresh
// wallet proof for the delete-account action instead.
const DeleteWalletAccountSchema = z.object({
  proof: z.unknown()
});

const walletAccountHasNoPassword = () =>
  NextResponse.json(
    { error: 'Wallet accounts do not have a password.' },
    { status: 400 }
  );

// Helper function to handle errors
const handleError = (error: unknown) => {
  if (error instanceof z.ZodError) {
    return NextResponse.json(
      { error: 'Invalid input', details: error.errors },
      { status: 400 }
    );
  }
  console.error('Error:', error);
  return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
};

// Helper function to get authenticated user
const getAuthenticatedUser = async () => {
  const user = await currentUser();
  if (!user || !user.id) {
    throw new Error('Unauthorized');
  }
  return user;
};

// POST function to change password
export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    const data = await request.json();
    const { currentPassword, newPassword } = ChangePasswordSchema.parse(data);

    const userRecord = await prisma.user.findUnique({
      where: { userId: user.id }
    });

    if (!userRecord) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    if (userRecord.authMethod === 'wallet') {
      return walletAccountHasNoPassword();
    }

    const isCurrentPasswordValid = await bcrypt.compare(
      currentPassword,
      userRecord.password
    );
    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      );
    }

    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    (await clerkClient()).users.updateUser(user.id, {
      password: hashedNewPassword
    });
    // await clerkClient().users.updateUser(user.id, {
    //   password: hashedNewPassword
    // });

    return NextResponse.json({ message: 'Password updated successfully' });
  } catch (error) {
    return handleError(error);
  }
}

// PUT function to update user profile data
export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    const data = await request.json();
    const validatedData = UpdateUserSchema.parse(data);
    
    await (
      await clerkClient()
    ).users.updateUser(user.id, {
      username: validatedData.username,
    });

    return NextResponse.json({
      message:
        'Profile updated successfully in Clerk. Webhook will sync with Prisma.'
    });
  } catch (error) {
    return handleError(error);
  }
}

// PATCH function to update user theme
export async function PATCH(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    const data = await request.json();
    const validatedData = UpdateThemeSchema.parse(data);

    // updateUserMetadata merges into publicMetadata. updateUser would replace
    // the whole object and delete every other key stored there, such as a
    // wallet user's bsvIdentityKey and authMethod.
    await (await clerkClient()).users.updateUserMetadata(user.id, {
      publicMetadata: { theme: validatedData.theme }
    });

    return NextResponse.json({
      message:
        'Theme updated successfully in Clerk. Webhook will sync with Prisma.'
    });
  } catch (error) {
    return handleError(error);
  }
}

// GET function to retrieve user data
export async function GET(request: NextRequest) {
  const user = await currentUser();

  if (!user || !user.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const userData = await prisma.user.findUnique({
      where: { userId: user.id },
    });

    if (!userData) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const safeUserData = JSON.parse(
      JSON.stringify(userData, (key, value) =>
        typeof value === 'bigint' ? value.toString() : value
      )
    );

    return NextResponse.json({
      message: 'User data retrieved successfully',
      data: safeUserData,
    });
  } catch (error) {
    console.error('Error fetching user data:', error);
    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}

// DELETE function to delete user account
export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser();
    const data = await request.json();

    const userRecord = await prisma.user.findUnique({
      where: { userId: user.id }
    });

    if (!userRecord) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    if (userRecord.authMethod === 'wallet') {
      return deleteWalletAccount(user.id, userRecord.identityKey, data);
    }

    const { password } = DeleteAccountSchema.parse(data);

    const isPasswordValid = await bcrypt.compare(password, userRecord.password);
    if (!isPasswordValid) {
      return NextResponse.json(
        { error: 'Incorrect password' },
        { status: 400 }
      );
    }

    (await clerkClient()).users.deleteUser(user.id);

    return NextResponse.json({
      message:
        'Account deleted successfully in Clerk. Webhook will sync with Prisma.'
    });
  } catch (error) {
    return handleError(error);
  }
}

// Deletes a wallet account once the signed-in user proves, with a fresh
// single-use proof, that they control the account's identity key. A proof
// for another key, another action or a replayed nonce is refused.
async function deleteWalletAccount(
  userId: string,
  identityKey: string | null,
  data: unknown
) {
  const { proof } = DeleteWalletAccountSchema.parse(data);

  const check = await verifyWalletProof(proof, DELETE_ACCOUNT_ACTION, {
    verifier: getServerWallet(),
    store: prismaWalletAuthStore
  });
  if (!check.valid || !identityKey || check.identityKey !== identityKey) {
    return NextResponse.json(
      { error: "Couldn't verify wallet. Please try again." },
      { status: 401 }
    );
  }

  await (await clerkClient()).users.deleteUser(userId);

  return NextResponse.json({
    message:
      'Account deleted successfully in Clerk. Webhook will sync with Prisma.'
  });
}
