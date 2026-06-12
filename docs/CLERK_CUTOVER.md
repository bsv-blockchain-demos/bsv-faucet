# Clerk Dev to Prod Cutover

## Context

The Clerk application was moved into the BSV Blockchain workspace and a production Clerk instance was cloned from the development instance. The deployed site still runs Clerk development keys. The production instance issues new user IDs, so migrated users get new `user_...` identifiers in prod. This document covers what must change to cut over safely. It does not perform the cutover.

## How the app stores Clerk identity

`User.userId` holds the Clerk user ID verbatim. `Transaction.userId` is a foreign key to `User.userId` and is declared `ON UPDATE CASCADE`. Per-user daily withdrawal limits are computed from `Transaction` rows filtered by `userId`. If the old dev IDs were left in place while users sign in with new prod IDs, every migrated user would look brand new and get a fresh daily limit, which is drainable. The chosen fix is a one-time ID remap (Option B).

## User ID remap (Option B)

The remap script is `scripts/remap-clerk-user-ids.ts`. It takes a mapping CSV of `old_user_id,new_user_id`, runs dry-run by default, and only writes with `--commit`. Because the foreign key cascades on update, it only updates `User.userId` and the related `Transaction` rows follow automatically.

Run order:

1. Produce the mapping CSV by joining the dev and prod Clerk exports with `scripts/generate-id-mapping.ts` (see `migration/README.md`). Review its reconciliation summary and resolve every unmatched row before continuing.

2. Dry-run against the target database to review the plan and row counts:

   ```
   dotenvx run -f .env.local -- npx tsx scripts/remap-clerk-user-ids.ts migration/exports/id-mapping.csv
   ```

3. Commit once the plan looks correct:

   ```
   dotenvx run -f .env.local -- npx tsx scripts/remap-clerk-user-ids.ts migration/exports/id-mapping.csv --commit
   ```

The script verifies after commit that the total user count is unchanged, that no old ID remains on `User`, and that no `Transaction` still references an old ID. It is idempotent: rows already migrated match nothing and are skipped, so re-running is safe. It aborts if a target new ID already belongs to a different existing user.

### CASCADE pre-flight

Before doing anything, the script asserts that the target database's `Transaction_userId_fkey` foreign key is ON UPDATE CASCADE (it queries `pg_constraint` and refuses to run unless `confupdtype = 'c'`). The Prisma schema declares the cascade, but the live database is proven to agree before any update is attempted. If the constraint is missing or not cascade, the script aborts with an explanation.

### Dry-run against a safe copy

Do not dry-run against live production. Take a copy first:

- If the database is on Neon, create a branch from production (Neon branches are copy-on-write and instant). Point a local `.env.local` `POSTGRES_*` at the branch connection string.
- Run the dry-run command above against that copy. It writes nothing and prints: planned user and cascading transaction rows per mapping entry, already-migrated no-ops, mapping old IDs not present in the DB, and DB users not covered by the mapping. Reconcile each category before the real `--commit` at cutover.

## Webhook re-registration

The webhook handler is at `app/api/webhooks/clerk/route.ts` (served at `/api/webhooks/clerk`). It verifies the svix signature using `WEBHOOK_SECRET` and handles `user.created`, `user.updated`, and `user.deleted`. The handler is now idempotent: `user.created` upserts on `userId` and refreshes only profile fields, so a replayed event or a `user.created` for an already-migrated user never resets `role`, `withdrawn`, `paused`, or `lastActive`. `user.deleted` tolerates a missing row.

At cutover:

1. In the production Clerk instance, go to Configure then Webhooks and register the endpoint URL that points at `/api/webhooks/clerk` (for example `https://bsvfaucet.com/api/webhooks/clerk`).

2. Subscribe to the same three events: `user.created`, `user.updated`, `user.deleted`.

3. Copy the production endpoint's signing secret and set `WEBHOOK_SECRET` in Vercel to that value. This secret differs between dev and prod.

## Hardcoded keys and URLs

A repo scan found no hardcoded `pk_test`, `sk_test`, `accounts.dev`, or Clerk frontend API URLs. All Clerk configuration comes from environment variables. The sign-in and sign-up URLs are relative paths (`/sign-in`, `/sign-up`) and work unchanged under production keys. One unrelated hardcoded URL (a `http://localhost:3001` self-fetch in the admin deposit-history panel) was removed: the deposit-history data now comes from `lib/depositHistory.ts` directly, so no env var is needed.

## Environment variable scoping

All variables are currently scoped to All Environments. During the validation window, Preview should run the production Clerk keys so preview deployments test against the prod Clerk instance with imported users, while Production stays on dev keys until the final cutover.

| Variable | Production (until cutover) | Preview (validation window) | Notes |
|----------|----------------------------|-----------------------------|-------|
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | dev key | prod key | Differs per environment during validation |
| `CLERK_SECRET_KEY` | dev secret | prod secret | Differs per environment; rotate, see below |
| `WEBHOOK_SECRET` | dev signing secret | prod signing secret | Differs per environment; rotate, see below |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | `/sign-in` | `/sign-in` | Relative, same everywhere |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | `/sign-up` | `/sign-up` | Relative, same everywhere |
| `TREASURY_WALLET_WIF` | new server-only key | new server-only key | Server-only, never prefix with NEXT_PUBLIC_ |
| `POSTGRES_*` | prod database | prod or branch database | `POSTGRES_PASSWORD` rotate, see below |
| `NEXT_PUBLIC_MAX_DAILY_WITHDRAWAL` | same | same | Public config |
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | same | same | Public by design |

At the final cutover, switch Production `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, and `WEBHOOK_SECRET` to the production values and redeploy.

## Rotation

Vercel flagged `WEBHOOK_SECRET`, `CLERK_SECRET_KEY`, and `POSTGRES_PASSWORD` as needing attention. Rotate them as part of cutover:

- `CLERK_SECRET_KEY` and `WEBHOOK_SECRET` become the production instance values, which are new by definition.
- `POSTGRES_PASSWORD` should be rotated in Neon and updated in Vercel as good hygiene during cutover.
- The treasury key is not rotated; the variable is only renamed to `TREASURY_WALLET_WIF` (same value).
