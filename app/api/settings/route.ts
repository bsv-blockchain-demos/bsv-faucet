import { NextResponse, NextRequest } from 'next/server';
import { currentUser, clerkClient } from '@clerk/nextjs/server';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { PrismaClient } from '@/prisma/generated/client/default';

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

    (await clerkClient()).users.updateUser(user.id, {
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
    const { password } = DeleteAccountSchema.parse(data);

    const userRecord = await prisma.user.findUnique({
      where: { userId: user.id }
    });

    if (!userRecord) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

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
