import { WebhookEvent, UserJSON } from '@clerk/nextjs/server';
import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  const WEBHOOK_SECRET = process.env.WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    throw new Error('Please add WEBHOOK_SECRET from Clerk Dashboard to .env or .env.local');
  }

  // Get the headers
  const headerPayload = await headers();
  const svix_id = headerPayload.get('svix-id');
  const svix_timestamp = headerPayload.get('svix-timestamp');
  const svix_signature = headerPayload.get('svix-signature');

  if (!svix_id || !svix_timestamp || !svix_signature) {
    return new Response('Error occurred -- no svix headers', { status: 400 });
  }

  // Get the body
  const payload = await req.json();
  const body = JSON.stringify(payload);

  const wh = new Webhook(WEBHOOK_SECRET);
  let evt: WebhookEvent;

  try {
    evt = wh.verify(body, {
      'svix-id': svix_id,
      'svix-timestamp': svix_timestamp,
      'svix-signature': svix_signature,
    }) as WebhookEvent;
  } catch (err) {
    console.error('Error verifying webhook:', err);
    return new Response('Error occurred', { status: 400 });
  }

  // Use the imported Clerk types to type-check the data
  const { data, type: eventType } = evt;

  try {
    if (eventType === 'user.created') {
      const userData = data as UserJSON;
      const username =
        userData.username ||
        `${userData.first_name || ''}${userData.last_name || ''}`.toLowerCase() ||
        userData.id.slice(0, 8);
      const email = userData.email_addresses[0]?.email_address || '';

      // Upsert keyed on userId so a replayed event, or a user.created for an
      // already-migrated user, refreshes only the mutable profile fields and
      // never resets rate-limit state (role, withdrawn, paused, lastActive).
      await prisma.user.upsert({
        where: { userId: userData.id },
        update: {
          username,
          email,
          imageUrl: userData.image_url,
        },
        create: {
          userId: userData.id,
          username,
          email,
          imageUrl: userData.image_url,
          role: 'user',
          theme: 'light',
          password: 'defaultPassword123', // Replace with a more secure approach if necessary
        },
      });
    }

    // Handle user updates
    else if (eventType === 'user.updated') {
      const userData = data as UserJSON;
      const username =
        userData.username ||
        `${userData.first_name || ''}${userData.last_name || ''}`.toLowerCase();
      const email = userData.email_addresses[0]?.email_address || '';

      // Upsert so an update that arrives before the row exists does not 500
      // and trigger an endless Svix retry loop.
      await prisma.user.upsert({
        where: { userId: userData.id },
        update: {
          username,
          email,
          imageUrl: userData.image_url,
        },
        create: {
          userId: userData.id,
          username: username || userData.id.slice(0, 8),
          email,
          imageUrl: userData.image_url,
          role: 'user',
          theme: 'light',
          password: 'defaultPassword123',
        },
      });
    }

    // Handle user deletion
    else if (eventType === 'user.deleted') {
      const deletedUserId = data.id as string;

      // deleteMany tolerates a missing row (count 0) so a redelivered delete
      // still returns 200 instead of throwing on a not-found record.
      await prisma.user.deleteMany({
        where: { userId: deletedUserId },
      });
    }


    return new Response('Webhook processed', { status: 200 });
  } catch (error) {
    console.error(`Error processing event ${eventType}:`, error);
    return new Response('Error processing event', { status: 500 });
  }
}
