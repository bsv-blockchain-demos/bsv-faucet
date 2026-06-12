# Preview Validation Checklist

Run this against a Vercel Preview deployment to prove the production Clerk stack
before cutover. During this window the Vercel Preview scope holds the production
Clerk values (`pk_live`, `sk_live`, and the production webhook signing secret),
while the Production scope keeps the development values untouched. Do not change
any Production-scope variable while validating.

Prerequisites:

- Users have been imported into the production Clerk instance (see
  `migration/README.md`).
- The production webhook endpoint is registered at
  `https://bsvfaucet.com/api/webhooks/clerk` for `user.created`, `user.updated`,
  and `user.deleted`. Preview deployments share the same production Clerk
  instance, so webhook deliveries for preview sign-ups appear under this endpoint.
- The Preview scope has the production `pk_live`, `sk_live`, and webhook signing
  secret set; the Production scope is unchanged.

## Checklist

### 1. Migrated-user sign-in

- [ ] Open the preview URL and sign in as a migrated user using their existing
      username and password.
- [ ] Sign-in succeeds with no email verification prompt (confirms emails were
      imported as verified).
- [ ] The dashboard loads and the user's existing claim history is visible
      (confirms the user resolves to their data; note that full history
      continuity depends on the database remap, which runs at cutover).

### 2. New sign-up provisions exactly once

- [ ] Sign up a throwaway account on the preview deployment.
- [ ] In the production Clerk dashboard, open the webhook endpoint and check Logs:
      the `user.created` delivery returns 200.
- [ ] Confirm the database has exactly one row for the new user (no duplicate).
      The sign-up redirect route and the webhook both upsert on `userId`, so they
      must not create two rows or reset state.

### 3. Claim / withdrawal flow end to end

- [ ] As a signed-in user, request a small testnet withdrawal to a valid testnet
      address.
- [ ] The transaction succeeds and a txid is returned. This exercises the
      server-only `TREASURY_WALLET_WIF` path; confirm the request payload contains
      no `wif` field (check the network tab).

### 4. Admin dashboard and deposit history

- [ ] Sign in as an admin and open the admin dashboard.
- [ ] Treasury balance loads and the deposit history table renders. Deposit
      history is served by a direct `lib/depositHistory.ts` call, so there is no
      external service or env var to configure.

### 5. Password reset email from the domain

- [ ] Trigger a password reset for a migrated user.
- [ ] The reset email arrives and is sent from the bsvfaucet.com domain. This
      exercises the clkmail and DKIM DNS records on the production Clerk instance.

## If all pass

The production Clerk stack is validated on preview. Proceed to the Phase 4
cutover in `CUTOVER.md`. If any step fails, fix it and re-run before cutover; do
not change Production-scope values until this checklist is green.
