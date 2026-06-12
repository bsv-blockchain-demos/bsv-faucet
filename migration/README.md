# Clerk dev-to-prod user migration tooling

This directory holds the tooling to migrate users from the development Clerk
instance into the production Clerk instance. The migration tool is a separate
Bun project that is cloned here, not vendored into the faucet app bundle.

Migration strategy is Option B: import users into prod (which assigns new user
IDs), then remap the database from old dev IDs to new prod IDs. See the repo
root `CUTOVER.md` for the full Phase 4 sequence and `docs/CLERK_CUTOVER.md` for
background.

## Directory layout

```
migration/
  README.md           # this file (committed)
  migration-script/   # cloned clerk/migration-script (gitignored)
  exports/            # CSV exports and the generated id mapping (gitignored)
```

Both `migration-script/` and `exports/` are gitignored. The dev export contains
password hashes and user PII. Never commit it. Delete the exports after the
migration is complete.

## One-time setup

The tool runs on Bun. Install Bun if you do not have it (https://bun.sh), then:

```sh
git clone https://github.com/clerk/migration-script migration/migration-script
cd migration/migration-script
bun install
```

## Step 1: Export users from the dev Clerk instance

In the development Clerk dashboard: Configure > Settings > User Exports (or
Settings > User Exports) > Export all users. Save the CSV as
`migration/exports/dev-export.csv`.

Verify before importing (do not assume):

- Open `dev-export.csv` and confirm the `password_hasher` column is `bcrypt`
  and `password_digest` looks like a bcrypt hash (`$2a$` or `$2b$...`). The tool
  passes the hasher through from this column; it is not hardcoded.
- Confirm `primary_email_address` and `username` are populated for real users.
- Note any rows with an empty `password_digest` (for example test or OAuth-only
  accounts). Those users cannot be imported with a password and will need a
  password reset on first prod sign-in. See the skip flag below.

## Step 2: Import into the prod Clerk instance

The tool ships a built-in `clerk` transformer that maps the dev export format to
the import format. It also sets each prod user's `external_id` to the old dev
user ID automatically (belt-and-braces alongside the database remap), and
imports email addresses as verified so migrated users do not hit a verification
wall.

Run the import with the production secret key. Never commit the key. Supply it
on the command line or in the tool's own `.env` (inside `migration-script/`,
which is gitignored):

```sh
cd migration/migration-script
bun migrate -t clerk -f ../exports/dev-export.csv -y --clerk-secret-key <prod sk_live...>
```

If any exported user has no password hash, add the tool's skip-password
requirement flag so the import does not fail on those rows. Confirm the exact
flag name with `bun migrate --help` before running. Those users reset their
password on first sign-in.

## Step 3: Export the prod users (after import)

Once the import finishes, export all users from the production Clerk dashboard
the same way and save as `migration/exports/prod-export.csv`. This gives the new
prod user IDs needed to build the remap mapping.

## Step 4: Generate the id mapping

The Clerk export CSV does not include an `external_id` column, so the old-to-new
mapping is built by joining the dev and prod exports on email (falling back to
username). From the repo root:

```sh
npx tsx scripts/generate-id-mapping.ts \
  migration/exports/dev-export.csv \
  migration/exports/prod-export.csv \
  --out migration/exports/id-mapping.csv
```

Read the reconciliation summary it prints: counts of dev users, prod users,
matched, and unmatched on each side. Every unmatched row is listed. Explain each
unmatched dev user (deleted account, test user) before running the remap. Without
`--out` the script prints the summary but writes nothing.

Optional cross-check: because the tool set `external_id` on each prod user to the
old dev ID, you can independently confirm the mapping with a Clerk Backend API
`getUserList` pass (read `external_id` and `id` per prod user) and compare to the
join output.

## Step 5: Remap the database

Run the remap in dry-run first, then with `--commit` during cutover. See the
remap dry-run procedure in `docs/CLERK_CUTOVER.md` and the Phase 4 sequence in
`CUTOVER.md`. The remap script refuses to run unless the target database's
`Transaction_userId_fkey` is ON UPDATE CASCADE.

## Cleanup

After cutover is verified, delete `migration/exports/` (password hashes and PII).
The cloned tool can stay or be removed; it holds no secrets once you remove its
`.env`.
