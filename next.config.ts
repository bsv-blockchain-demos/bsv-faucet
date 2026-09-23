import { walletRelayRewrites } from './lib/walletRelay';

export default {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com'
      },
      {
        protocol: 'https',
        hostname: '*.public.blob.vercel-storage.com'
      },
      { protocol: 'https', hostname: 'img.clerk.com' }
    ]
  },
  // Phone wallet sign-in: the browser and the phone reach the relay service
  // through the faucet's own origin. See lib/walletRelay.ts for why.
  async rewrites() {
    return walletRelayRewrites(process.env.WALLET_RELAY_URL);
  }
};
