/**
 * Remap Clerk user IDs from the old (dev) instance to the new (prod) instance.
 *
 * Background: User.userId stores the Clerk user ID verbatim, and
 * Transaction.userId is a foreign key to it declared ON UPDATE CASCADE
 * (see prisma/migrations/20241107052503_/migration.sql). Updating User.userId
 * therefore cascades to every related Transaction row automatically, so this
 * script only needs to update the single User.userId column per mapping row.
 *
 * The mapping CSV is produced by the Clerk import. Expected format:
 *
 *   old_user_id,new_user_id
 *   user_2oldDevId...,user_2newProdId...
 *
 * A header row is optional and auto-detected.
 *
 * Usage (dry-run by default, writes nothing):
 *   dotenvx run -f .env.local -- npx tsx scripts/remap-clerk-user-ids.ts mapping.csv
 *
 * Commit the changes:
 *   dotenvx run -f .env.local -- npx tsx scripts/remap-clerk-user-ids.ts mapping.csv --commit
 *
 * The script is idempotent: a row whose user has already been remapped to the
 * new ID matches zero old rows and is a safe no-op, so re-running is harmless.
 */
import { readFileSync } from 'fs';
import { PrismaClient } from '../prisma/generated/client';

const prisma = new PrismaClient();

interface Mapping {
  oldId: string;
  newId: string;
}

function parseCsv(path: string): Mapping[] {
  const raw = readFileSync(path, 'utf8');
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length === 0) {
    throw new Error(`Mapping CSV ${path} is empty`);
  }

  // Auto-detect and skip a header row.
  const first = lines[0].toLowerCase();
  const startIndex = first.includes('old') && first.includes('new') ? 1 : 0;

  const mappings: Mapping[] = [];
  for (let i = startIndex; i < lines.length; i++) {
    const parts = lines[i].split(',').map((p) => p.trim());
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      throw new Error(`Malformed CSV row ${i + 1}: "${lines[i]}"`);
    }
    mappings.push({ oldId: parts[0], newId: parts[1] });
  }
  return mappings;
}

function assertNoDuplicates(mappings: Mapping[]): void {
  const olds = new Set<string>();
  const news = new Set<string>();
  for (const m of mappings) {
    if (olds.has(m.oldId)) {
      throw new Error(`Duplicate old_user_id in CSV: ${m.oldId}`);
    }
    if (news.has(m.newId)) {
      throw new Error(`Duplicate new_user_id in CSV: ${m.newId}`);
    }
    olds.add(m.oldId);
    news.add(m.newId);
  }

  // Chained remaps (an id that is both an old and a new) are not supported and
  // can violate the unique constraint mid-transaction. Prod IDs should be
  // brand new and disjoint from dev IDs, so this guards against a bad CSV.
  for (const m of mappings) {
    if (news.has(m.oldId)) {
      throw new Error(
        `Chained remap detected: ${m.oldId} appears as both an old and a new ID. Not supported.`
      );
    }
  }
}

// Pre-flight: prove the TARGET database actually has ON UPDATE CASCADE on the
// Transaction -> User foreign key. The whole remap relies on updating User.userId
// and letting the cascade rewrite Transaction.userId. The Prisma schema declares
// the cascade, but a live database could have drifted, so verify it directly.
async function assertCascadeFk() {
  const rows = await prisma.$queryRaw<Array<{ confupdtype: string }>>`
    SELECT confupdtype::text AS confupdtype
    FROM pg_constraint
    WHERE conname = 'Transaction_userId_fkey'
  `;
  if (rows.length === 0) {
    console.error(
      'Aborting: foreign key "Transaction_userId_fkey" not found in the target database. ' +
        'Cannot guarantee Transaction.userId will follow the User.userId update.'
    );
    process.exit(1);
  }
  // confupdtype: 'c' = CASCADE, 'a' = NO ACTION, 'r' = RESTRICT, 'n' = SET NULL, 'd' = SET DEFAULT.
  if (rows[0].confupdtype !== 'c') {
    console.error(
      `Aborting: Transaction_userId_fkey ON UPDATE action is '${rows[0].confupdtype}', not CASCADE ('c'). ` +
        'Remapping User.userId would orphan or null Transaction.userId. Fix the FK before running.'
    );
    process.exit(1);
  }
  console.log('Pre-flight: Transaction_userId_fkey ON UPDATE CASCADE confirmed.\n');
}

async function main() {
  const args = process.argv.slice(2);
  const commit = args.includes('--commit');
  const csvPath = args.find((a) => !a.startsWith('--')) || process.env.MAPPING_CSV;

  if (!csvPath) {
    console.error(
      'Error: provide a mapping CSV path.\n' +
        '  Usage: tsx scripts/remap-clerk-user-ids.ts <mapping.csv> [--commit]'
    );
    process.exit(1);
  }

  const mappings = parseCsv(csvPath);
  assertNoDuplicates(mappings);

  console.log(`Mode: ${commit ? 'COMMIT (will write)' : 'DRY-RUN (no writes)'}`);
  console.log(`Mapping rows: ${mappings.length}\n`);

  await assertCascadeFk();

  const oldIds = mappings.map((m) => m.oldId);
  const newIds = mappings.map((m) => m.newId);
  const oldIdSet = new Set(oldIds);
  const newIdSet = new Set(newIds);

  // Collision guard: a target new ID that already belongs to a different user
  // who is NOT being vacated in this batch would violate the unique
  // constraint. Abort before writing anything.
  const existingNew = await prisma.user.findMany({
    where: { userId: { in: newIds } },
    select: { userId: true }
  });
  const collisions = existingNew
    .map((u) => u.userId)
    // If the new ID is also an old ID in this batch it will be vacated, but we
    // already forbid that in assertNoDuplicates, so any hit here is a real one.
    .filter((id) => newIdSet.has(id));
  if (collisions.length > 0) {
    console.error(
      `Aborting: ${collisions.length} target new ID(s) already exist in the database:\n` +
        collisions.map((c) => `  ${c}`).join('\n')
    );
    process.exit(1);
  }

  // Build the plan: how many User rows and Transaction rows each mapping touches.
  const userCountBefore = await prisma.user.count();
  let plannedUserUpdates = 0;
  let plannedTxCascades = 0;
  const alreadyMigrated: string[] = [];
  const missing: string[] = [];

  console.log('Planned changes:');
  for (const m of mappings) {
    const userMatches = await prisma.user.count({ where: { userId: m.oldId } });
    const txMatches = await prisma.transaction.count({
      where: { userId: m.oldId }
    });

    if (userMatches === 0) {
      const alreadyThere = await prisma.user.count({
        where: { userId: m.newId }
      });
      if (alreadyThere > 0) {
        alreadyMigrated.push(m.oldId);
      } else {
        missing.push(m.oldId);
      }
      continue;
    }

    plannedUserUpdates += userMatches;
    plannedTxCascades += txMatches;
    console.log(
      `  ${m.oldId} -> ${m.newId}  (user rows: ${userMatches}, cascading tx rows: ${txMatches})`
    );
  }

  console.log('\nSummary:');
  console.log(`  User rows to update:        ${plannedUserUpdates}`);
  console.log(`  Transaction rows cascading: ${plannedTxCascades}`);
  console.log(`  Already migrated (no-op):   ${alreadyMigrated.length}`);
  console.log(`  Old ID not found (skipped): ${missing.length}`);
  if (missing.length > 0) {
    console.log('  Mapping old IDs not present in DB:');
    console.log('    ' + missing.join('\n    '));
  }
  console.log(`  Total users before:         ${userCountBefore}`);

  // Reverse check: DB users the mapping does not cover (neither an old ID to
  // remap nor an already-migrated new ID). These rows are left untouched; the
  // human should confirm each is expected (seed/admin/test accounts).
  const allDbUsers = await prisma.user.findMany({ select: { userId: true } });
  const dbNotInMapping = allDbUsers
    .map((u) => u.userId)
    .filter((id) => !oldIdSet.has(id) && !newIdSet.has(id));
  console.log(`  DB users not in mapping:    ${dbNotInMapping.length}`);
  if (dbNotInMapping.length > 0) {
    console.log('    ' + dbNotInMapping.join('\n    '));
  }

  if (!commit) {
    console.log('\nDry-run complete. No changes written. Re-run with --commit to apply.');
    return;
  }

  // Apply all updates in a single transaction. ON UPDATE CASCADE propagates the
  // new userId to Transaction.userId automatically.
  console.log('\nApplying updates in a single transaction...');
  await prisma.$transaction(
    mappings.map((m) =>
      prisma.user.updateMany({
        where: { userId: m.oldId },
        data: { userId: m.newId }
      })
    )
  );

  // Verification.
  console.log('\nVerifying...');
  const userCountAfter = await prisma.user.count();
  const oldStillPresent = await prisma.user.count({
    where: { userId: { in: oldIds } }
  });
  const txStillOnOld = await prisma.transaction.count({
    where: { userId: { in: oldIds } }
  });
  const newPresent = await prisma.user.count({
    where: { userId: { in: newIds } }
  });

  const ok =
    userCountAfter === userCountBefore &&
    oldStillPresent === 0 &&
    txStillOnOld === 0;

  console.log(`  Total users (before -> after): ${userCountBefore} -> ${userCountAfter}`);
  console.log(`  Old IDs still on User:         ${oldStillPresent} (expected 0)`);
  console.log(`  Transactions still on old IDs: ${txStillOnOld} (expected 0)`);
  console.log(`  New IDs now present on User:   ${newPresent}`);

  if (!ok) {
    console.error('\nVERIFICATION FAILED. Review the counts above.');
    process.exit(1);
  }
  console.log('\nVerification passed. Remap committed successfully.');
}

main()
  .catch((err) => {
    console.error('Remap failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
