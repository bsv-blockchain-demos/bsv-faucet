# BSV Testnet Faucet

A testnet faucet for the BSV blockchain. Provides developers and testers with free testnet coins for testing applications without acquiring real BSV. Built with Next.js and deployed on Vercel.

**Live:** [bsvfaucet.com](https://bsvfaucet.com)

## Features

- Request testnet BSV tokens (configurable daily limit per user)
- Treasury wallet with automatic deposit monitoring
- Transaction history with BEEF transaction viewer
- Admin dashboard with treasury balance, user management, and deposit history
- Dark mode support
- Authentication via Clerk
- ReCAPTCHA support (optional)

## Tech Stack

| Category | Technology |
|----------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript |
| Auth | Clerk |
| Database | PostgreSQL |
| ORM | Prisma |
| Blockchain | @bsv/sdk v2 |
| Styling | Tailwind CSS + shadcn/ui |
| Deployment | Vercel |

## Prerequisites

- Node.js >= 22
- pnpm >= 9
- PostgreSQL database (Vercel Postgres, Neon, Supabase, or local)
- [Clerk](https://clerk.com) account (authentication)
- BSV testnet wallet WIF key (treasury wallet)

## Setup

### 1. Clone and install

```sh
git clone https://github.com/bsv-blockchain-demos/bsv-faucet.git
cd bsv-faucet
pnpm install
```

### 2. Configure environment variables

Copy the example env file and fill in the values:

```sh
cp .env.example .env.local
```

**If deploying to Vercel**, you can pull env variables directly:

```sh
npm i -g vercel
vercel link
vercel env pull
```

#### Required variables

| Variable | Description |
|----------|-------------|
| `POSTGRES_PRISMA_URL` | PostgreSQL connection string (used by Prisma) |
| `POSTGRES_URL_NON_POOLING` | Direct PostgreSQL connection (for migrations) |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |
| `CLERK_SECRET_KEY` | Clerk secret key |
| `WEBHOOK_SECRET` | Clerk webhook secret for user sync |
| `NEXT_PUBLIC_TREASURY_WALLET_WIF` | WIF private key for the testnet treasury wallet |
| `NEXT_PUBLIC_MAX_DAILY_WITHDRAWAL` | Max satoshis a user can withdraw per day (e.g. `10000000`) |

#### Optional variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_RECAPTCHA_SITE_KEY` | Google ReCAPTCHA site key (currently disabled in code) |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL` | Sign-in route (default: `/sign-in`) |
| `NEXT_PUBLIC_CLERK_SIGN_UP_URL` | Sign-up route (default: `/sign-up`) |

### 3. Set up the database

Generate the Prisma client and run migrations:

```sh
pnpm prisma:migrate:dev
```

To reset the database and seed with fresh data:

```sh
pnpm prisma:db:seed
```

### 4. Run the dev server

```sh
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Available Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server with Turbopack |
| `pnpm build` | Production build |
| `pnpm start` | Start production server |
| `pnpm prisma:generate` | Regenerate Prisma client |
| `pnpm prisma:migrate:dev` | Create and run migrations |
| `pnpm prisma:migrate:reset` | Reset database and re-run all migrations |
| `pnpm prisma:studio` | Open Prisma Studio (database GUI) |
| `pnpm prisma:db:seed` | Seed the database |

## Project Structure

```
app/
  (dashboard)/          # Dashboard layout and pages
    admin/              # Admin panel (treasury, user management)
    dashboard/          # Main faucet page (request tokens)
    requests/           # Transaction request history
    settings/           # User settings (appearance, security)
    users/              # Admin user management table
    wallet/             # Wallet page
  api/
    wallet/             # Wallet API routes (balance, send, monitor, generate)
    transactions/       # Transaction API routes
    webhook/            # Clerk webhook handler
components/
  adminTreasuryHistory/ # Admin treasury balance and deposit history
  ui/                   # shadcn/ui components
context/
  ThemeContext.tsx       # Dark/light mode provider
lib/
  wallet/               # BSV wallet logic (transactions, monitoring, generation)
  prisma.ts             # Prisma client and data fetching helpers
  utils.ts              # Shared utilities
prisma/
  schema.prisma         # Database schema
  migrations/           # Migration files
```

## Database Schema

The app uses four main models:

- **User** — Clerk-synced users with roles (`user`/`admin`), withdrawal tracking, and pause status
- **Transaction** — Deposits and withdrawals with BEEF transaction data and UTXO outputs
- **Wallet** — Treasury wallet management (master, hot, cold types)
- **WalletAddress** — User-submitted withdrawal addresses

## How It Works

1. Users sign in via Clerk and request testnet BSV by providing a testnet address and amount
2. The server validates the request against the daily withdrawal limit
3. A transaction is created using the treasury wallet's WIF key via `@bsv/sdk`
4. The transaction is broadcast and recorded in the database
5. A cron-based monitor watches for incoming deposits to the treasury wallet

## Database Migrations

When modifying `prisma/schema.prisma`:

```sh
pnpm prisma:migrate:dev
```

You'll be prompted for a migration name. The migration runs against your local database immediately. Commit the generated migration file in your PR.

See [Prisma team development workflow](https://www.prisma.io/docs/orm/prisma-migrate/workflows/team-development) for details.

## Contributing

1. Fork the repo
2. Create a feature branch
3. Make your changes (include migration scripts if schema changed)
4. Open a PR with a description of what changed and why

## Resources

- [BSV SDK Documentation](https://github.com/bitcoin-sv/ts-sdk)
- [BSV Testnet Setup](https://docs.bsvblockchain.org/network-topology/nodes/sv-node/installation/sv-node/network-environments/testnet)
- [Clerk Documentation](https://clerk.com/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Next.js App Router](https://nextjs.org/docs/app)

## License

ISC
