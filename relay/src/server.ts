/**
 * The pairing relay for phone wallet sign-in.
 *
 * A laptop without a wallet shows a QR code; the user's phone (BSV Browser)
 * scans it, opens a WebSocket to this process, and from then on every wallet
 * call the faucet makes is forwarded to the phone over an encrypted channel.
 * The relay never sees plaintext and holds no keys but its own.
 *
 * It is a separate process because it keeps pairing sessions in memory and
 * holds the phone's socket open, which a Vercel function cannot do. Run it as
 * exactly one always-on instance. WhatsOnChain runs the same service as a
 * second process beside its Next.js app; the faucet runs it on Railway.
 *
 * Routes, all registered by the library:
 *   GET    /api/session       create a session (QR, pairing URI, desktop token)
 *   GET    /api/session/:id   status and relay address (the phone calls this
 *                             through the faucet's origin after scanning)
 *   POST   /api/request/:id   forward a wallet call to the phone
 *   DELETE /api/session/:id   end a session
 *   WS     /ws                the phone's connection
 */

import http from 'node:http';
import cors from 'cors';
import express from 'express';
import { PrivateKey, ProtoWallet } from '@bsv/sdk';
import { WalletRelayService } from '@bsv/wallet-relay';

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} environment variable is required`);
  return value;
}

const port = Number(process.env['PORT'] ?? 3021);
const relayUrl = required('RELAY_URL');
const origin = required('ORIGIN');
const allowedOrigins = (process.env['ALLOWED_ORIGINS'] ?? origin)
  .split(',')
  .map((value) => value.trim())
  .filter(Boolean);

// The phone derives its shared secret from this key's public half, which is
// embedded in every QR code, so the key must stay the same across restarts.
// Rotating it breaks pairings that are in flight, nothing more.
const wallet = new ProtoWallet(
  PrivateKey.fromHex(required('WALLET_RELAY_PRIVATE_KEY'))
);

const app = express();
app.set('trust proxy', true);
app.use(
  cors({
    origin: allowedOrigins,
    // The desktop token is how the browser proves it created the session.
    // Without it in the allowlist the browser's preflight blocks every call.
    allowedHeaders: ['Content-Type', 'X-Desktop-Token']
  })
);
app.use(express.json({ limit: '256kb' }));

app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

const server = http.createServer(app);

const relay = new WalletRelayService({
  app,
  server,
  wallet,
  relayUrl,
  origin,
  allowedOrigins,
  onSessionConnected: (id) => console.info(`[relay] phone connected ${id}`),
  onSessionDisconnected: (id) =>
    console.info(`[relay] phone disconnected ${id}`)
});

server.listen(port, '0.0.0.0', () => {
  console.info(`[relay] listening on port ${port}`);
  console.info(`[relay] relay address ${relayUrl}`);
  console.info(`[relay] origin ${origin}`);
});

// Railway sends SIGTERM on redeploy. Closing the sockets tells every paired
// phone the session is over instead of leaving it waiting for a heartbeat.
function shutdown(signal: string) {
  console.info(`[relay] ${signal} received, shutting down`);
  relay.stop();
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
