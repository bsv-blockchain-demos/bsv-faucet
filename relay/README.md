# Pairing relay for phone wallet sign-in

A small always-on Node service that lets someone on a computer without a BSV wallet sign in to the faucet with the wallet on their phone. The faucet shows a QR code, BSV Browser on the phone scans it and opens a WebSocket to this relay, and from then on the faucet's sign-in flow talks to the phone through the relay as if it were a local wallet. The channel is end to end encrypted; the relay never sees plaintext and holds no keys but its own.

It is a separate process because it keeps pairing sessions in memory and holds the phone's socket open, which the faucet's Vercel functions cannot do. It must run as exactly one instance. WhatsOnChain runs the same `@bsv/wallet-relay` service as a second process beside its Next.js app; the faucet runs it on Railway at `relay.bsvfaucet.com`.

## How the pieces fit

- The browser calls the relay through the faucet's own origin: `next.config.ts` rewrites `/wallet-relay/api/*` to this service. Same origin means no CORS and the relay's address never reaches the client bundle.
- The QR code carries the faucet's origin, not the relay's address. After scanning, the phone fetches `https://bsvfaucet.com/api/session/{topic}`, which the faucet also rewrites here, and reads the relay's `wss://` address from the answer. The faucet's TLS certificate is what the phone trusts.
- The phone connects to this service's `/ws` directly. Nothing else does.
- Once paired, `components/auth/MobileWalletSignIn.tsx` runs the ordinary wallet sign-in flow with the relay's wallet proxy in place of the local wallet. The login route is unchanged.

## Environment

| Variable                   | Purpose                                                                                                                                                              |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `WALLET_RELAY_PRIVATE_KEY` | The relay's own key, as hex. Its public half is in every QR code and the phone derives the shared secret from it, so it must not change between restarts. A dedicated key: never the faucet's auth key and never the treasury key. |
| `RELAY_URL`                | This service's public WebSocket address, `wss://relay.bsvfaucet.com` in production. `ws://` is only accepted on localhost.                                            |
| `ORIGIN`                   | The faucet's public origin, `https://bsvfaucet.com`. Embedded in the QR code and shown to the user on the phone.                                                     |
| `ALLOWED_ORIGINS`          | Optional comma-separated list of browser origins allowed to create sessions. Defaults to `ORIGIN` alone.                                                              |
| `PORT`                     | Listening port. Railway sets it.                                                                                                                                      |

Generate a key with:

```sh
node -e "const {PrivateKey}=require('@bsv/sdk'); console.log(PrivateKey.fromRandom().toHex())"
```

Run that once, paste the result straight into the hosting environment, and do not keep it in a file inside the repository.

## Run locally

```sh
cd relay
pnpm install
cp .env.example .env   # fill in WALLET_RELAY_PRIVATE_KEY
pnpm dev
```

Then in the app's `.env.local` set `NEXT_PUBLIC_WALLET_RELAY_ENABLED=true` and `WALLET_RELAY_URL=http://localhost:3021`, and set the relay's `ORIGIN` to the app's local URL. The QR page at `/sign-in-mobile` will show a code, but a real phone cannot pair with a plain `http://` origin: BSV Browser only accepts HTTPS origins, with localhost exempt for same-device development. To pair a phone locally, put the app behind an HTTPS tunnel and use the tunnel's URL as `ORIGIN`.

## Deploy on Railway

1. In Railway, create a service from the `bsv-faucet` GitHub repository and set its root directory to `relay`. `relay/railway.json` selects the Dockerfile, one replica and the `/health` check.
2. Set the variables above. `RELAY_URL` is `wss://relay.bsvfaucet.com` and `ORIGIN` is `https://bsvfaucet.com`.
3. Add the custom domain `relay.bsvfaucet.com` to the service and create the CNAME it asks for. The faucet's DNS is on Vercel's nameservers, so the record goes in the Vercel dashboard under the domain. Railway issues the certificate.
4. In Vercel, set `WALLET_RELAY_URL=https://relay.bsvfaucet.com` for production. It is read at build time, so redeploy afterwards. Leave `NEXT_PUBLIC_WALLET_RELAY_ENABLED` unset until a real phone has paired against production, then set it to `true` and redeploy.

Check the service with `curl https://relay.bsvfaucet.com/health` and `curl https://bsvfaucet.com/api/session/nonexistent`, which should answer `{"ok":true}` and a 404 from the relay respectively.

Redeploys restart the process and end any pairing in progress; users see "Your phone disconnected" and can show a new code. Sessions are not persisted, which is fine, because a pairing only has to live as long as one sign-in.

## Versions

The relay and the app both use `@bsv/wallet-relay` 0.5.0. BSV Browser's own client is 0.2.1, and the pairing protocol has not changed since 0.1.1, so the versions interoperate. Keep the two `package.json` files on the same version when upgrading.
