# BSV Testnet Faucet

Free testnet BSV for building and testing apps on the BSV blockchain. A faucet sends small amounts of testnet coins to your wallet so you can try transactions and integrations without buying mainnet BSV.

**[Use the faucet at bsvfaucet.com](https://bsvfaucet.com)**

Sign in, enter a BSV testnet address, and choose an amount in satoshis. You can view your transaction history and return unused coins to the faucet's donation address.

## How it works

The app sends coins from a shared treasury wallet, applies a configurable withdrawal limit per user over a rolling 24-hour period, and records transactions in PostgreSQL. An admin dashboard provides treasury and user management.

Built with Next.js, TypeScript, Clerk for sign-in, Prisma and PostgreSQL for storage, and `@bsv/sdk` for transactions. Blockchain queries and broadcasts use WhatsOnChain.

## Run locally

You will need Node.js 22+, pnpm 9, a PostgreSQL database, a Clerk application, and a funded BSV testnet wallet to act as the treasury.

### 1. Install

```sh
git clone https://github.com/bsv-blockchain-demos/bsv-faucet.git
cd bsv-faucet
pnpm install
cp .env.example .env.local
```

### 2. Configure

Fill in these values in `.env.local`:

| Variable                            | Purpose                                                                                       |
| ----------------------------------- | --------------------------------------------------------------------------------------------- |
| `POSTGRES_PRISMA_URL`               | PostgreSQL connection string for the app and migrations.                                      |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Publishable key from your Clerk application.                                                  |
| `CLERK_SECRET_KEY`                  | Secret key from the same Clerk application.                                                   |
| `WEBHOOK_SECRET`                    | Clerk webhook signing secret, configured in step 4.                                           |
| `TREASURY_WALLET_WIF`               | Treasury wallet's private key in WIF format. Keep this server-side.                           |
| `NEXT_PUBLIC_MAX_DAILY_WITHDRAWAL`  | Per-user limit in satoshis, for example `10000000` (0.1 BSV). Defaults to `1000000` if unset. |
| `WOC_API_KEY`                       | Optional WhatsOnChain API key, recommended to reduce shared rate-limit errors.                |
| `NEXT_PUBLIC_WALLET_AUTH_ENABLED`   | `true` adds the BSV Wallet tab to the sign-in and sign-up pages. Needs `FAUCET_AUTH_PRIVATE_KEY`. |
| `NEXT_PUBLIC_WALLET_RELAY_ENABLED`  | `true` adds "Connect with phone via QR code" to the wallet tab. Needs `WALLET_RELAY_URL` and the relay in [`relay/`](relay/README.md). |

Keep the sign-in and sign-up paths from [`.env.example`](.env.example). The other `POSTGRES_*` entries are unused by the current Prisma schema. reCAPTCHA is currently disabled.

### 3. Set up the database and start

Use a development database, then run:

```sh
pnpm prisma:migrate:dev --skip-seed
pnpm dev
```

This applies migrations and generates the Prisma client. Sample seed data is not needed to run the faucet.

Open [localhost:3000](http://localhost:3000).

### 4. Connect Clerk and fund the treasury

Expose your local server through an HTTPS tunnel. In Clerk, add a webhook endpoint at `https://<your-tunnel-host>/api/webhooks/clerk` and subscribe to `user.created`, `user.updated`, and `user.deleted`. Copy its signing secret into `WEBHOOK_SECRET` and restart the dev server.

Create an account through the app after the webhook is connected. If the account already exists, resend its `user.created` event from Clerk to create the local user record.

The dashboard shows the treasury's public address under **Donate to faucet**. Send BSV testnet coins to that address before requesting a withdrawal. The faucet distributes existing coins; it does not create them.

For admin access, run `pnpm prisma:studio` and change your user's `role` to `admin`.

## Development

| Command                               | Purpose                                           |
| ------------------------------------- | ------------------------------------------------- |
| `pnpm dev`                            | Start the development server.                     |
| `pnpm build`                          | Build for production.                             |
| `pnpm start`                          | Serve the production build.                       |
| `pnpm prisma:migrate:dev --skip-seed` | Create and apply migrations after schema changes. |
| `pnpm prisma:studio`                  | Browse and edit the development database.         |

Pages and API routes live in `app/`, wallet logic in `lib/wallet/`, and the database schema and migrations in `prisma/`. Include generated migrations when contributing schema changes.

Phone wallet sign-in by QR code needs the pairing relay in [`relay/`](relay/README.md), a separate always-on service deployed on Railway. Its README covers running it locally and deploying it.

For Vercel, configure the environment variables and use `pnpm vercel-build` as the build command. It generates the Prisma client, applies committed migrations, and builds the app. Point Clerk's webhook at the deployed domain.

Existing deployment and Clerk migration guides:

- [Clerk user migration](migration/README.md)
- [Preview validation](PREVIEW_VALIDATION.md)
- [Clerk configuration and user ID remapping](docs/CLERK_CUTOVER.md)
- [Production cutover and rollback](CUTOVER.md)

## Licence

[MIT](LICENSE.md)
