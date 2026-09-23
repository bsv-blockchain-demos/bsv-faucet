import { WebhookEvent, UserJSON } from '@clerk/nextjs/server';
import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { prisma } from '@/lib/prisma';
import { upsertUserFromClerk } from '@/lib/clerkUserSync';

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
    if (eventType === 'user.created' || eventType === 'user.updated') {
      // Writes null for a missing email and copies identityKey and
      // authMethod from public_metadata, so this and the wallet login route
      // agree whichever lands first. See lib/clerkUserSync.ts.
      await upsertUserFromClerk(eventType, data as UserJSON);
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
