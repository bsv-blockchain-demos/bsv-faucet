declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // system
      readonly NODE_ENV: 'development' | 'production' | 'test';
      // private
      readonly POSTGRES_PRISMA_URL: string;
      readonly CLERK_SECRET_KEY: string;
      readonly WEBHOOK_SECRET: string;
      // Treasury wallet private key (WIF). Server-only.
      readonly TREASURY_WALLET_WIF: string;
      // WhatsOnChain API key. Optional; lifts the per-IP rate limit. Server-only.
      readonly WOC_API_KEY?: string;
      // The faucet's own wallet sign-in key, as hex. Wallets sign their
      // sign-in proofs towards its public key. A dedicated key, never the
      // treasury key. Server-only.
      readonly FAUCET_AUTH_PRIVATE_KEY?: string;
      // Phone wallet sign-in: the relay service's HTTPS base URL, for example
      // https://relay.bsvfaucet.com. Read by next.config.ts at build time to
      // set up the rewrites that put the relay behind the faucet's origin.
      readonly WALLET_RELAY_URL?: string;
      // public
      readonly NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: string;
      readonly NEXT_PUBLIC_CLERK_SIGN_IN_URL: string;
      readonly NEXT_PUBLIC_CLERK_SIGN_UP_URL: string;
      readonly NEXT_PUBLIC_MAX_DAILY_WITHDRAWAL: string;
      // 'true' shows the BSV wallet tab and enables the wallet-auth routes.
      readonly NEXT_PUBLIC_WALLET_AUTH_ENABLED?: string;
      // 'true' shows the "Connect with phone via QR code" card and enables
      // the /sign-in-mobile page. Needs WALLET_RELAY_URL as well.
      readonly NEXT_PUBLIC_WALLET_RELAY_ENABLED?: string;
      // Domain passed to WalletClient and shown in wallet prompts. Defaults
      // to the page's own host when unset.
      readonly NEXT_PUBLIC_WALLET_ORIGINATOR?: string;
      // Development only: a direct wallet URL such as http://127.0.0.1:3321,
      // for when the wallet's local HTTPS certificate is not trusted.
      readonly NEXT_PUBLIC_BSV_WALLET_URL?: string;
    }
  }
}
