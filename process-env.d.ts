declare global {
  namespace NodeJS {
    interface ProcessEnv {
      // system
      readonly NODE_ENV: 'development' | 'production' | 'test';
      // private
      readonly POSTGRES_URL: string;
      readonly POSTGRES_PRISMA_URL: string;
      readonly POSTGRES_URL_NO_SSL: string;
      readonly POSTGRES_URL_NON_POOLING: string;
      readonly POSTGRES_USER: string;
      readonly POSTGRES_HOST: string;
      readonly POSTGRES_PASSWORD: string;
      readonly POSTGRES_DATABASE: string;
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
      // public
      readonly NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: string;
      readonly NEXT_PUBLIC_CLERK_SIGN_IN_URL: string;
      readonly NEXT_PUBLIC_CLERK_SIGN_UP_URL: string;
      readonly NEXT_PUBLIC_RECAPTCHA_SITE_KEY: string;
      readonly NEXT_PUBLIC_MAX_DAILY_WITHDRAWAL: string;
      // 'true' shows the BSV wallet tab and enables the wallet-auth routes.
      readonly NEXT_PUBLIC_WALLET_AUTH_ENABLED?: string;
      // Domain passed to WalletClient and shown in wallet prompts. Defaults
      // to the page's own host when unset.
      readonly NEXT_PUBLIC_WALLET_ORIGINATOR?: string;
      // Development only: a direct wallet URL such as http://127.0.0.1:3321,
      // for when the wallet's local HTTPS certificate is not trusted.
      readonly NEXT_PUBLIC_BSV_WALLET_URL?: string;
    }
  }
}
