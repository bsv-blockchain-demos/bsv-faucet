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
      // public
      readonly NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: string;
      readonly NEXT_PUBLIC_CLERK_SIGN_IN_URL: string;
      readonly NEXT_PUBLIC_CLERK_SIGN_UP_URL: string;
      readonly NEXT_PUBLIC_RECAPTCHA_SITE_KEY: string;
      readonly NEXT_PUBLIC_MAX_DAILY_WITHDRAWAL: string;
    }
  }
}
