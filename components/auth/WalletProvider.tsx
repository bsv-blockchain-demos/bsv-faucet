'use client';

import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { HTTPWalletJSON, WalletClient } from '@bsv/sdk';

// Development escape hatch: point straight at a wallet's HTTP endpoint (for
// example http://127.0.0.1:3321 for BSV Desktop's plain HTTP fallback) and
// skip substrate probing. Useful when the wallet's local HTTPS certificate is
// not trusted by the browser. Unset in production.
const DEV_WALLET_URL = process.env.NEXT_PUBLIC_BSV_WALLET_URL;

// The name wallets show for the app asking for permission. In a browser the
// wallet also sees the page's real Origin header, so the page's own host is a
// correct default when the variable is unset.
const CONFIGURED_ORIGINATOR = process.env.NEXT_PUBLIC_WALLET_ORIGINATOR;

const WalletContext = createContext<WalletClient | null>(null);

/** One WalletClient per page, so detection and signing share a connection. */
export function WalletProvider({ children }: { children: ReactNode }) {
  const wallet = useMemo(() => {
    const originator =
      CONFIGURED_ORIGINATOR ||
      (typeof window !== 'undefined' ? window.location.host : undefined);
    if (DEV_WALLET_URL) {
      return new WalletClient(
        new HTTPWalletJSON(originator, DEV_WALLET_URL),
        originator
      );
    }
    return new WalletClient('auto', originator);
  }, []);

  return (
    <WalletContext.Provider value={wallet}>{children}</WalletContext.Provider>
  );
}

export function useWallet(): WalletClient {
  const wallet = useContext(WalletContext);
  if (!wallet) throw new Error('useWallet must be used inside <WalletProvider>');
  return wallet;
}
