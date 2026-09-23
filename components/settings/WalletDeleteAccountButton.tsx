'use client';

import { useRef, useState } from 'react';
import axios from 'axios';
import { Trash2 } from 'lucide-react';
import { createAuthProof } from '@bsv/auth';
import { WalletProvider, useWallet } from '@/components/auth/WalletProvider';
import {
  WALLET_TIMEOUT_MESSAGE,
  fetchServerKey,
  walletErrorMessage
} from '@/hooks/useWalletSignIn';
import { AUTH_PROTOCOL, DELETE_ACCOUNT_ACTION } from '@/lib/walletAuth';

const PROMPT_TIMEOUT_MS = 60_000;

type Props = {
  onDeleted: (message: string) => void;
  onError: (message: string) => void;
};

/**
 * A wallet account has no password, so deletion is confirmed with a fresh,
 * single-use wallet proof for the delete-account action. The server checks
 * that the proof's key is this account's key.
 */
export function WalletDeleteAccountButton(props: Props) {
  return (
    <WalletProvider>
      <DeleteButton {...props} />
    </WalletProvider>
  );
}

function DeleteButton({ onDeleted, onError }: Props) {
  const wallet = useWallet();
  const [busy, setBusy] = useState(false);
  const attemptRef = useRef(0);

  const handleDelete = async () => {
    const confirmed = confirm(
      'Are you sure you want to delete your account? This action cannot be undone. Your wallet will ask you to approve.'
    );
    if (!confirmed) return;

    const attempt = ++attemptRef.current;
    const abandoned = () => attemptRef.current !== attempt;
    setBusy(true);
    // The wallet call cannot be cancelled. After the timeout a late proof is
    // ignored, so the account is never deleted behind the user's back.
    const timeout = setTimeout(() => {
      if (abandoned()) return;
      attemptRef.current++;
      setBusy(false);
      onError(WALLET_TIMEOUT_MESSAGE);
    }, PROMPT_TIMEOUT_MS);

    try {
      const serverKey = await fetchServerKey();
      // As in useWalletSignIn: a wallet that answers after the timeout is
      // not then asked to sign.
      await wallet.getPublicKey({ identityKey: true });
      if (abandoned()) return;
      const proof = await createAuthProof({
        wallet,
        counterparty: serverKey,
        action: DELETE_ACCOUNT_ACTION,
        protocol: AUTH_PROTOCOL
      });
      if (abandoned()) return;
      const response = await axios.delete('/api/settings', {
        data: { proof }
      });
      onDeleted(response.data.message);
    } catch (err: any) {
      if (abandoned()) return;
      setBusy(false);
      onError(err?.response?.data?.error || walletErrorMessage(err));
    } finally {
      clearTimeout(timeout);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={busy}
      aria-busy={busy}
      className="inline-flex h-11 items-center gap-2 rounded-full border-[1.5px] border-destructive bg-transparent px-5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10 disabled:cursor-progress disabled:opacity-75"
    >
      <Trash2 className="h-4 w-4" />
      {busy ? 'Approve in your wallet…' : 'Delete account'}
    </button>
  );
}
