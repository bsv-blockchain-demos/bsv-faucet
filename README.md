## Description
 
Create an open-source faucet service offering small amounts of digital tokens for testing purposes on the BSV Blockchain. This service aids developers and testers in their work without requiring them to acquire real digital currencies. It's applicable to non-production environments such as testnet.

A testnet faucet provides users with free testnet tokens for testing and development. This allows developers to test their applications and smart contracts before deploying them to the main network.

## Introduction

Bitcoin SV (BSV) is a blockchain that aims to maintain the original vision of Bitcoin, focusing on scalability, security, and stability. This list gathers various resources to help you explore, develop, and contribute to the BSV ecosystem.

## **Getting Started**

- [Getting Started with Bitcoin testnet](https://docs.bsvblockchain.org/network-topology/nodes/sv-node/installation/sv-node/network-environments/testnet)
- [System Requirements](https://docs.bsvblockchain.org/network-topology/nodes/sv-node/system-requirements)

#### BSV Quick Start

- [Quick Start](https://docs.bsvblockchain.org/intro/quick-start)
- [BSV Tools and Libraries](https://www.bsvblockchain.org/features/tools-libraries)

- [Bitcoin SV Website](https://bitcoinsv.io/)
- [Bitcoin SV Wiki](https://en.wikipedia.org/wiki/Bitcoin_SV)
- [BSV Developer Documentation](https://docs.bitcoinsv.io/)
- [BSV GitHub Repository](https://github.com/bitcoin-sv/bitcoin-sv)
- [Open Standards](https://openstandards.cash/) for industry collaboration
- [BSV Wiki](https://wiki.bitcoinsv.io/) – Aim to provide correct and up-to-date information on the Bitcoin protocol, network, and its features and functionality.
- [Paymail](https://tsc.bsvblockchain.org/standards/paymail/) – A collection of protocols for BSV blockchain wallets that allow for a set of simplified user experiences to be delivered across all wallets in the ecosystem.

#### BSV Development Libraries

- [Official BSV SDK](https://github.com/bitcoin-sv/ts-sdk) maintained by the BSV Association with zero dependencies.
- [Bitcoin SV Lib](https://github.com/moneybutton/bsv) - A pure and powerful JavaScript Bitcoin SV library. A fork of BitPay's bitcore-lib-cash, but for Bitcoin SV only. Maintained by Yours Inc.

#### Application Technology Stack

- Framework - Next.js (App Router)
- Language - TypeScript
- Auth - Clerk
- Database - Postgres
- ORM - Prisma
- Deployment - Vercel
- Styling - Tailwind CSS
- Components - Shadcn UI
- Analytics - Vercel Analytics
- Formatting - Prettier

This uses the new Next.js App Router. This includes support for enhanced layouts, colocation of components, tests, and styles, component-level data fetching, and more.

## Pre-requisites

To successfully finish this guide, you'll need:

- Node.js >= 22
- pnpm >= 9
- A Vercel Account (to set up a free Postgres database and deploy the app)

## Getting Started

During the deployment, Vercel will prompt you to create a new Postgres database. This will add the necessary environment variables to your project.

Next, copy the .env.example file to .env.local and update the values. Follow the instructions in the .env.example file to set up your env variables.

```sh
npm i -g vercel
vercel link
vercel env pull
```

When your env variables are setup you then need to install the dependencies and you'll be able to setup the database and seed it:

```sh
pnpm install
pnpm prisma:migrate:reset
```

Finally, run the following command to start the development server:

```sh
pnpm dev
```

You should now be able to access the application at http://localhost:3000.

## Database Schema Management

Maintaining a consistent PostgreSQL database schema is crucial for collaboration among all contributors.

This section outlines the process for managing schema changes, creating migration scripts, and ensuring everyone is on the same page.

#### Creating Migration Scripts

First, make some change to the Prisma schema in `prisma/schema.prisma`.

To create a migration script, run the following command in your terminal:

```sh
pnpm prisma:migrate:dev
```

You will be prompted for a name to describe the changes being made (e.g., create_users_table).
The migration script will be run against your own local DB so you can start developing your new feature right-away.

[Read more about the Prisma workflow.](https://www.prisma.io/docs/orm/prisma-migrate/workflows/team-development)

#### Creating a Pull Request

After testing your migration scripts, create a pull request (PR) in the repository:
Include a concise description of the schema changes.
List the migration scripts included in the PR.
Reference any discussions related to your changes.
Tag other contributors for review.

#### Documenting Changes

Update the README or project wiki to reflect any changes to the schema, including new tables, fields, or relationships
  
