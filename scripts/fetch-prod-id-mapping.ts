/**
 * Build the old-to-new Clerk user ID mapping directly from the production Clerk
 * instance, using each user's external_id (which the migration tool set to the
 * old dev user ID).
 *
 * This is the most reliable mapping source: it is an exact old->new join with no
 * email/username matching. Prod users with no external_id (e.g. people who
 * signed up directly in prod) are reported and excluded.
 *
 * Requires CLERK_SECRET_KEY (prod sk_live) in the environment. Run it from a
 * directory whose .env holds the key, e.g. the migration tool dir, so the key
 * is never passed on the command line:
 *
 *   cd migration/migration-script && ~/.bun/bin/bun \
 *     ../../scripts/fetch-prod-id-mapping.ts --out ../exports/id-mapping.csv
 *
 * Read-only against Clerk; writes the CSV only when --out is given.
 */
import { writeFileSync } from 'fs';

const API = 'https://api.clerk.com/v1';

interface ClerkUser {
  id: string;
  external_id: string | null;
  username: string | null;
  email_addresses?: Array<{ email_address: string }>;
}

async function fetchAllUsers(secret: string): Promise<ClerkUser[]> {
  const users: ClerkUser[] = [];
  const limit = 100;
  let offset = 0;
  for (;;) {
    const res = await fetch(`${API}/users?limit=${limit}&offset=${offset}&order_by=-created_at`, {
      headers: { Authorization: `Bearer ${secret}` }
    });
    if (!res.ok) {
      throw new Error(`Clerk API ${res.status}: ${await res.text()}`);
    }
    const page = (await res.json()) as ClerkUser[];
    users.push(...page);
    if (page.length < limit) break;
    offset += limit;
  }
  return users;
}

async function main() {
  const args = process.argv.slice(2);
  const outIdx = args.indexOf('--out');
  const outPath = outIdx !== -1 ? args[outIdx + 1] : undefined;

  const secret = process.env.CLERK_SECRET_KEY;
  if (!secret) {
    console.error('CLERK_SECRET_KEY is not set (expected the prod sk_live).');
    process.exit(1);
  }
  if (!secret.startsWith('sk_live')) {
    console.error(`Refusing to run: CLERK_SECRET_KEY does not start with sk_live (got ${secret.slice(0, 7)}).`);
    process.exit(1);
  }

  const users = await fetchAllUsers(secret);
  const withExternal = users.filter((u) => u.external_id);
  const withoutExternal = users.filter((u) => !u.external_id);

  console.log('Prod Clerk user mapping');
  console.log(`  Total prod users:          ${users.length}`);
  console.log(`  With external_id (mapped): ${withExternal.length}`);
  console.log(`  Without external_id:       ${withoutExternal.length}`);
  if (withoutExternal.length > 0) {
    console.log('\nProd users with no external_id (direct prod sign-ups or manual; not in mapping):');
    for (const u of withoutExternal) {
      const email = u.email_addresses?.[0]?.email_address || '(no email)';
      console.log(`  ${u.id}  email=${email}  username=${u.username || '(none)'}`);
    }
  }

  const csv =
    'old_user_id,new_user_id\n' +
    withExternal.map((u) => `${u.external_id},${u.id}`).join('\n') +
    (withExternal.length ? '\n' : '');

  if (outPath) {
    writeFileSync(outPath, csv, 'utf8');
    console.log(`\nWrote ${withExternal.length} mapping rows to ${outPath}`);
  } else {
    console.log('\nNo --out given; mapping not written. Re-run with --out <path> to write the CSV.');
  }
}

main().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
