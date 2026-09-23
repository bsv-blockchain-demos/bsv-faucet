'use client';

import type { ReactNode } from 'react';
import { Mail, Wallet } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export type AuthMethod = 'email' | 'wallet';

/**
 * The Email and BSV Wallet tabs. Built on the Radix tabs primitive, which
 * gives arrow-key navigation and the tab ARIA roles.
 *
 * The accessible label is "Account type", not "Sign-in method": a wallet
 * sign-in and an email sign-in are two separate faucet accounts, and a label
 * suggesting two ways into one account would mislead.
 */
export function AuthMethodTabs({
  value,
  onChange,
  email,
  wallet
}: {
  value: AuthMethod;
  onChange: (method: AuthMethod) => void;
  email: ReactNode;
  wallet: ReactNode;
}) {
  return (
    <Tabs value={value} onValueChange={(v) => onChange(v as AuthMethod)}>
      <TabsList aria-label="Account type">
        <TabsTrigger value="email" className="gap-2">
          <Mail className="h-4 w-4" aria-hidden />
          Email
        </TabsTrigger>
        <TabsTrigger value="wallet" className="gap-2">
          <Wallet className="h-4 w-4" aria-hidden />
          BSV Wallet
        </TabsTrigger>
      </TabsList>
      <div className="mt-6">
        <TabsContent value="email" className="mt-0">
          {email}
        </TabsContent>
        <TabsContent value="wallet" className="mt-0">
          {wallet}
        </TabsContent>
      </div>
    </Tabs>
  );
}
