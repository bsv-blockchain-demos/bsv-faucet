# Treasury Wallet Key

## Status

The treasury wallet private key was stored in an environment variable named `NEXT_PUBLIC_TREASURY_WALLET_WIF`. The `NEXT_PUBLIC_` prefix is a risk because Next.js inlines such variables into the client bundle wherever they are referenced in client code.

Exposure was verified on the live deployment. A global search of all loaded client bundles, including after exercising the claim and withdrawal flow, found no trace of the WIF value, and the wallet's on-chain history shows no unexplained outflows. The value is consumed only in server-side code, so despite the prefix it was never inlined into client JS.

Decision: the key is not rotated and the wallet is not swept. The existing WIF stays. The only remaining action is to remove the misleading prefix so a future build can never inline it.

## Code changes already made

- The variable is read as `TREASURY_WALLET_WIF` (no prefix) everywhere: `app/api/wallet/send/route.ts`, `app/api/wallet/balance/route.ts`, `app/api/wallet/treasury-address/route.ts`, `lib/wallet/monitorTransactions.ts`, and `prisma/seed.ts`.
- `/api/wallet/send` reads the WIF from server env and no longer accepts it from the request body. The client no longer sends or reads the WIF.
- The treasury address shown in the dashboard is derived server-side via `GET /api/wallet/treasury-address`.
- Regression guard: `lib/wallet/transactions.ts` and `lib/wallet/monitorTransactions.ts` import the `server-only` package. If a client component ever imports the treasury or signing logic, the build fails with a clear error before any key can be inlined.

## Operator step at cutover

This is now a single Vercel change, same value, no fund movement:

1. In Vercel, add `TREASURY_WALLET_WIF` with the same WIF value the old variable held.
2. Remove `NEXT_PUBLIC_TREASURY_WALLET_WIF`.
3. Redeploy.

## Verify after deploy

- `GET /api/wallet/treasury-address` returns the expected address.
- `GET /api/wallet/balance` returns the expected balance.
- A small test withdrawal through the dashboard succeeds, and the request payload contains no `wif` field.

## Local development note

Update your local `.env.local` to use `TREASURY_WALLET_WIF` instead of `NEXT_PUBLIC_TREASURY_WALLET_WIF`. Same value, new name.
