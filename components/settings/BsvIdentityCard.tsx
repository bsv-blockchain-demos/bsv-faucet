'use client';

import { Copy } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { toast } from '@/hooks/use-toast';

/**
 * The identity key a wallet account signs in with. Shown in full, not
 * truncated: this is the page people come to when they need to read it.
 */
export function BsvIdentityCard({ identityKey }: { identityKey: string }) {
  const copy = async () => {
    await navigator.clipboard.writeText(identityKey);
    toast({
      title: 'Copied to clipboard',
      description: 'Identity key copied to clipboard'
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>BSV identity key</CardTitle>
        <CardDescription>
          The public key your wallet signs in with. It identifies your faucet
          account and is safe to share.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <button
          type="button"
          onClick={copy}
          title="Copy identity key"
          className="flex w-full items-center justify-between gap-2.5 rounded-xl bg-accent px-4 py-3.5 text-left text-accent-foreground transition-[filter] hover:brightness-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <span className="break-all font-mono text-[13px] font-semibold">
            {identityKey}
          </span>
          <Copy className="h-[18px] w-[18px] shrink-0" aria-hidden />
          <span className="sr-only">Copy identity key</span>
        </button>
        <p className="mt-3 text-[13px] text-muted-foreground">
          It is not a secret. Your wallet keeps the private key, and the faucet
          never sees it.
        </p>
      </CardContent>
    </Card>
  );
}
