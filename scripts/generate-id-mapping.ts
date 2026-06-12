/**
 * Generate the old-to-new Clerk user ID mapping for the dev-to-prod migration.
 *
 * The Clerk dashboard CSV export does not include an external_id column, so the
 * mapping cannot be read directly from the prod export. This script builds it by
 * joining the dev export and the prod export (both Clerk dashboard CSVs) on email
 * address, falling back to username when email is missing or ambiguous. The
 * output feeds scripts/remap-clerk-user-ids.ts.
 *
 * Read-only by default: it prints a reconciliation summary and writes the mapping
 * CSV only when --out is given.
 *
 * Usage:
 *   npx tsx scripts/generate-id-mapping.ts <dev-export.csv> <prod-export.csv>
 *   npx tsx scripts/generate-id-mapping.ts <dev-export.csv> <prod-export.csv> --out migration/exports/id-mapping.csv
 *
 * Cross-check: prod users carry external_id = old dev id (set by the migration
 * tool). A Backend API getUserList pass can independently confirm this mapping.
 */
import { readFileSync, writeFileSync } from 'fs';

interface ClerkRow {
  id: string;
  email: string; // lowercased primary_email_address
  username: string;
}

// Minimal RFC-4180-ish CSV parser: handles quoted fields, embedded commas,
// escaped double quotes, and CRLF. Sufficient for Clerk dashboard exports.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let field = '';
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ',') {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function loadClerkExport(path: string): ClerkRow[] {
  const raw = readFileSync(path, 'utf8');
  // A Clerk export may start with a comment line (e.g. the sample password note);
  // skip any leading lines until the header row that contains "id".
  const allRows = parseCsv(raw).filter((r) => r.some((c) => c.trim().length > 0));
  let headerIndex = allRows.findIndex(
    (r) => r.map((c) => c.trim().toLowerCase()).includes('id')
  );
  if (headerIndex === -1) headerIndex = 0;
  const header = allRows[headerIndex].map((c) => c.trim().toLowerCase());
  const idIdx = header.indexOf('id');
  const emailIdx = header.indexOf('primary_email_address');
  const usernameIdx = header.indexOf('username');
  if (idIdx === -1) {
    throw new Error(`${path}: could not find an "id" column in the header`);
  }

  const out: ClerkRow[] = [];
  for (let i = headerIndex + 1; i < allRows.length; i++) {
    const r = allRows[i];
    const id = (r[idIdx] || '').trim();
    if (!id) continue;
    out.push({
      id,
      email: emailIdx === -1 ? '' : (r[emailIdx] || '').trim().toLowerCase(),
      username: usernameIdx === -1 ? '' : (r[usernameIdx] || '').trim()
    });
  }
  return out;
}

// Build a lookup keyed by `key`, recording rows so we can detect collisions.
function indexBy(rows: ClerkRow[], key: (r: ClerkRow) => string): Map<string, ClerkRow[]> {
  const m = new Map<string, ClerkRow[]>();
  for (const r of rows) {
    const k = key(r);
    if (!k) continue;
    const list = m.get(k) || [];
    list.push(r);
    m.set(k, list);
  }
  return m;
}

function main() {
  const args = process.argv.slice(2);
  const positionals = args.filter((a) => !a.startsWith('--'));
  const outIdx = args.indexOf('--out');
  const outPath = outIdx !== -1 ? args[outIdx + 1] : undefined;

  const [devPath, prodPath] = positionals;
  if (!devPath || !prodPath) {
    console.error(
      'Usage: tsx scripts/generate-id-mapping.ts <dev-export.csv> <prod-export.csv> [--out <path>]'
    );
    process.exit(1);
  }

  const dev = loadClerkExport(devPath);
  const prod = loadClerkExport(prodPath);

  const prodByEmail = indexBy(prod, (r) => r.email);
  const prodByUsername = indexBy(prod, (r) => r.username.toLowerCase());

  const mapping: Array<{ oldId: string; newId: string; via: string }> = [];
  const unmatchedDev: ClerkRow[] = [];
  const matchedProdIds = new Set<string>();

  for (const d of dev) {
    let match: ClerkRow | undefined;
    let via = '';

    // Primary: email join (emails are unique within a Clerk instance).
    if (d.email) {
      const byEmail = prodByEmail.get(d.email) || [];
      if (byEmail.length === 1) {
        match = byEmail[0];
        via = 'email';
      } else if (byEmail.length > 1 && d.username) {
        // Ambiguous email: fall back to username among the candidates.
        match = byEmail.find(
          (p) => p.username.toLowerCase() === d.username.toLowerCase()
        );
        if (match) via = 'email+username';
      }
    }

    // Fallback: username join when email is empty or did not resolve.
    if (!match && d.username) {
      const byUser = prodByUsername.get(d.username.toLowerCase()) || [];
      if (byUser.length === 1) {
        match = byUser[0];
        via = 'username';
      }
    }

    if (match) {
      mapping.push({ oldId: d.id, newId: match.id, via });
      matchedProdIds.add(match.id);
    } else {
      unmatchedDev.push(d);
    }
  }

  const unmatchedProd = prod.filter((p) => !matchedProdIds.has(p.id));

  // Reconciliation summary.
  console.log('Reconciliation summary');
  console.log(`  Dev users:            ${dev.length}`);
  console.log(`  Prod users:           ${prod.length}`);
  console.log(`  Matched:              ${mapping.length}`);
  console.log(`  Unmatched in dev:     ${unmatchedDev.length}`);
  console.log(`  Unmatched in prod:    ${unmatchedProd.length}`);

  if (unmatchedDev.length > 0) {
    console.log('\nDev users with no prod match (explain each before remap):');
    for (const d of unmatchedDev) {
      console.log(`  ${d.id}  email=${d.email || '(none)'}  username=${d.username || '(none)'}`);
    }
  }
  if (unmatchedProd.length > 0) {
    console.log('\nProd users not matched to any dev user (new sign-ups or test accounts):');
    for (const p of unmatchedProd) {
      console.log(`  ${p.id}  email=${p.email || '(none)'}  username=${p.username || '(none)'}`);
    }
  }

  const csv =
    'old_user_id,new_user_id\n' +
    mapping.map((m) => `${m.oldId},${m.newId}`).join('\n') +
    (mapping.length ? '\n' : '');

  if (outPath) {
    writeFileSync(outPath, csv, 'utf8');
    console.log(`\nWrote ${mapping.length} mapping rows to ${outPath}`);
    if (unmatchedDev.length > 0) {
      console.log(
        'WARNING: some dev users are unmatched and are NOT in the mapping. ' +
          'Their DB rows will keep old IDs after remap. Resolve before --commit.'
      );
    }
  } else {
    console.log('\nNo --out given; mapping not written. Re-run with --out <path> to write the CSV.');
  }
}

main();
