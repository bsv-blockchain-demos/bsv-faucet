# Production Cutover Checklist

This is the execution-order checklist for taking the BSV Faucet from Clerk development keys to the production Clerk instance, and for renaming the treasury key variable. The supporting detail lives in `docs/TREASURY_KEY.md` and `docs/CLERK_CUTOVER.md`.

The live site must keep working on dev Clerk keys until the final swap. Do not change Production Clerk keys until the steps that explicitly say so.

## Phase 0: Preconditions

- [ ] Code changes from this branch are merged and deployed (treasury key is server-only, webhook is idempotent, hardcoded deposit URL is configurable).
- [ ] Production Clerk instance exists and the `bsvfaucet.com` Clerk DNS records have verified.
- [ ] You have the Clerk import mapping CSV (old dev ID to new prod ID) ready, or know how to produce it.

## Phase 1: Rename the treasury key variable (can happen first, independent of Clerk)

Exposure was verified as not having occurred, so the key is not rotated and the wallet is not swept. This is a rename only, same value. See `docs/TREASURY_KEY.md`.

- [ ] Add `TREASURY_WALLET_WIF` (server-only, no prefix) to Vercel with the same WIF value the old variable held.
- [ ] Remove `NEXT_PUBLIC_TREASURY_WALLET_WIF` from Vercel.
- [ ] Redeploy and verify treasury-address, balance, and a test withdrawal with no `wif` in the payload.

## Phase 2: Prepare Preview to validate against prod Clerk

See the scoping table in `docs/CLERK_CUTOVER.md`.

- [ ] Scope `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, and `WEBHOOK_SECRET` so Preview uses production Clerk values while Production keeps dev values.
- [ ] Register the webhook endpoint in the production Clerk instance (Configure then Webhooks), subscribed to `user.created`, `user.updated`, `user.deleted`.
- [ ] Confirm a preview deployment can sign in with an imported prod user.

## Phase 3: Remap user IDs

See `docs/CLERK_CUTOVER.md`.

- [ ] Run the remap script in dry-run and review the plan and counts:
      `dotenvx run -f .env.local -- npx tsx scripts/remap-clerk-user-ids.ts mapping.csv`
- [ ] Run with `--commit` and confirm the verification output passes (user count unchanged, zero old IDs left, zero transactions on old IDs).

## Phase 4: Final cutover

- [ ] Switch Production `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, and `WEBHOOK_SECRET` to production values.
- [ ] Confirm `WEBHOOK_SECRET` matches the production endpoint signing secret.
- [ ] Redeploy Production.
- [ ] Verify the Development mode banner is gone and sign-in, sign-up, and a withdrawal all work for a migrated user with their daily limit intact.

## Phase 5: Rotate remaining secrets

- [ ] Rotate `POSTGRES_PASSWORD` in Neon and update Vercel.
- [ ] Confirm `CLERK_SECRET_KEY` and `WEBHOOK_SECRET` now hold production values (new by definition).
- [ ] Remove any temporary Preview-only scoping that is no longer needed.
