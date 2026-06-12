# Clerk Dev to Prod Cutover

## Context

The Clerk application was moved into the BSV Blockchain workspace and a production Clerk instance was cloned from the development instance. The deployed site still runs Clerk development keys. The production instance issues new user IDs, so migrated users get new `user_...` identifiers in prod. This document covers what must change to cut over safely. It does not perform the cutover.

## How the app stores Clerk identity

`User.userId` holds the Clerk user ID verbatim. `Transaction.userId` is a foreign key to `User.userId` and is declared `ON UPDATE CASCADE`. Per-user daily withdrawal limits are computed from `Transaction` rows filtered by `userId`. If the old dev IDs were left in place while users sign in with new prod IDs, every migrated user would look brand new and get a fresh daily limit, which is drainable. The chosen fix is a one-time ID remap (Option B).

## User ID remap (Option B)

The remap script is `scripts/remap-clerk-user-ids.ts`. It takes a mapping CSV of `old_user_id,new_user_id` produced by the Clerk import, runs dry-run by default, and only writes with `--commit`. Because the foreign key cascades on update, it only updates `User.userId` and the related `Transaction` rows follow automatically.

Run order:

1. Produce the mapping CSV from the Clerk import (old dev ID in column one, new prod ID in column two). A header row is optional.

2. Dry-run against the target database to review the plan and row counts:

   ```
   dotenvx run -f .env.local -- npx tsx scripts/remap-clerk-user-ids.ts mapping.csv
   ```

3. Commit once the plan looks correct:

   ```
   dotenvx run -f .env.local -- npx tsx scripts/remap-clerk-user-ids.ts mapping.csv --commit
   ```

The script verifies after commit that the total user count is unchanged, that no old ID remains on `User`, and that no `Transaction` still references an old ID. It is idempotent: rows already migrated match nothing and are skipped, so re-running is safe. It aborts if a target new ID already belongs to a different existing user.

## Webhook re-registration

The webhook handler is at `app/api/webhook/route.ts`. It verifies the svix signature using `WEBHOOK_SECRET` and handles `user.created`, `user.updated`, and `user.deleted`. The handler is now idempotent: `user.created` upserts on `userId` and refreshes only profile fields, so a replayed event or a `user.created` for an already-migrated user never resets `role`, `withdrawn`, `paused`, or `lastActive`. `user.deleted` tolerates a missing row.

At cutover:

1. In the production Clerk instance, go to Configure then Webhooks and register the same endpoint URL that points at `/api/webhook`.

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
- The treasury key is not rotated. Exposure was verified as not having occurred; the variable is only renamed. See `docs/TREASURY_KEY.md`.
