# Production Cutover Checklist

Execution-order checklist for moving the BSV Faucet from the Clerk development
instance to the production instance. The live site keeps running on dev Clerk
keys until the final swap in Phase 4. Supporting detail: `docs/CLERK_CUTOVER.md`,
`migration/README.md`, and `PREVIEW_VALIDATION.md`.

Migration strategy is Option B (database ID remap). The treasury WIF is renamed,
not rotated.

## Phase 1: Code hardening (done)

Merged to main and deployed: treasury key server-only as `TREASURY_WALLET_WIF`,
idempotent Clerk webhook at `/api/webhooks/clerk`, idempotent sign-up route,
deposit history served directly from `lib/depositHistory.ts`, and the remap and
mapping scripts under `scripts/`.

## Phase 2: Rename the treasury variable (independent of Clerk)

Rename only, same value, no fund movement.

- [ ] Add `TREASURY_WALLET_WIF` (server-only, no prefix) in Vercel with the same
      WIF value the old variable held.
- [ ] Remove `NEXT_PUBLIC_TREASURY_WALLET_WIF` from Vercel.
- [ ] Redeploy and verify treasury-address, balance, and a test withdrawal with
      no `wif` in the payload.

## Phase 3: Staged validation on Preview

Prove the production Clerk stack on a Vercel Preview deployment while Production
stays on dev keys. See `docs/CLERK_CUTOVER.md` for the env-scoping table and
`migration/README.md` for the user import.

- [ ] Import dev users into the production Clerk instance (`migration/README.md`).
- [ ] Confirm the prod webhook endpoint is registered at
      `https://bsvfaucet.com/api/webhooks/clerk` for the three user events, with
      its signing secret saved. The code path already matches; no Clerk dashboard
      URL change is needed.
- [ ] Set the Preview scope to the production `pk_live`, `sk_live`, and webhook
      signing secret. Leave the Production scope on dev values.
- [ ] Run `PREVIEW_VALIDATION.md` end to end against a preview deployment.
- [ ] Generate and review the id mapping with
      `scripts/generate-id-mapping.ts`; explain every unmatched row.
- [ ] Run the remap in dry-run against a safe DB copy (see the dry-run procedure
      in `docs/CLERK_CUTOVER.md`); confirm the plan and that it writes nothing.

Proceed to Phase 4 only once Phase 3 is green.

## Phase 4: Cutover (in order)

Keep the window between the remap and the key swap short. Between those two
steps the DB holds new prod IDs while the live app still presents dev IDs, so
migrated users will not resolve to their data until the keys are swapped and the
deployment is live. Run this at a low-traffic time or behind a brief maintenance
notice.

1. [ ] Re-export dev users and re-run the import to catch stragglers (anyone who
       signed up since the last export). The tool dedupes on `external_id`, so
       re-importing is safe. If new users appeared, re-export prod and regenerate
       `migration/exports/id-mapping.csv`.
2. [ ] Take a database backup (Neon point-in-time restore is enabled by default;
       create an explicit branch or snapshot as the named rollback point).
3. [ ] Run the remap with `--commit`:
       `dotenvx run -f .env.local -- npx tsx scripts/remap-clerk-user-ids.ts migration/exports/id-mapping.csv --commit`
       (the script refuses to run unless the target FK is ON UPDATE CASCADE).
4. [ ] Confirm the script's post-commit verification passes: user count
       unchanged, zero old IDs left on `User`, zero `Transaction` rows on old IDs.
5. [ ] Swap the three Vercel Production-scope values to production:
       `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`, `WEBHOOK_SECRET`
       (the production webhook endpoint's signing secret).
6. [ ] Redeploy Production.
7. [ ] Smoke test on production:
       - [ ] Migrated user signs in with existing username and password, no
             verification prompt.
       - [ ] That user's claim history is intact.
       - [ ] A small claim/withdrawal succeeds.
       - [ ] A fresh sign-up provisions exactly one DB row via the webhook.
       - [ ] The Clerk "Development mode" banner is gone.

## Rollback

If Phase 4 fails verification or smoke testing:

1. [ ] Revert the three Vercel Production-scope values to the dev Clerk values.
2. [ ] Redeploy Production.
3. [ ] Restore the pre-remap database backup taken in Phase 4 step 2.

The dev Clerk instance and its user IDs are unchanged by the cutover, so
reverting keys plus restoring the DB returns the site to its pre-cutover state.

## Phase 5: Post-cutover hygiene

- [ ] Rotate `POSTGRES_PASSWORD` in Neon and update Vercel.
- [ ] Delete `migration/exports/` (contains password hashes and PII) and remove
      the migration tool's `.env`.
- [ ] Remove the temporary Preview-scope overrides once Production runs prod keys.
