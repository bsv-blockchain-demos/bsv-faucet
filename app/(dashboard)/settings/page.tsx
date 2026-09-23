'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useUser } from '@clerk/nextjs';
import axios from 'axios';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, Trash2 } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useTheme } from '@/context/ThemeContext';
import { BsvIdentityCard } from '@/components/settings/BsvIdentityCard';
import { WalletDeleteAccountButton } from '@/components/settings/WalletDeleteAccountButton';

interface UserData {
  id: number;
  username: string;
  email: string | null;
  theme: string;
  role: string;
  authMethod: 'email' | 'wallet';
  identityKey: string | null;
}

export default function SettingsPage() {
  const { user } = useUser();
  const router = useRouter();
  const { theme, toggleTheme } = useTheme();

  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const response = await axios.get('/api/settings');
        setUserData(response.data.data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Failed to fetch user data');
      } finally {
        setLoading(false);
      }
    };

    fetchUserData();
  }, []);

  const handleDeleteAccount = async () => {
    const confirmDelete = confirm(
      'Are you sure you want to delete your account? This action cannot be undone.'
    );
    if (!confirmDelete) return;

    const password = prompt('Please enter your password to confirm deletion:');
    if (!password) {
      alert('Password is required to delete your account.');
      return;
    }

    try {
      const response = await axios.delete('/api/settings', {
        data: { password }
      });
      alert(response.data.message);
      router.push('/'); // Redirect to homepage after deletion
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete account');
    }
  };

  if (loading)
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  if (!userData)
    return (
      <div className="flex h-[60vh] items-center justify-center text-muted-foreground">
        No user data available.
      </div>
    );

  // Wallet accounts have no email and no password, so those sections are
  // hidden, and deletion is confirmed with the wallet instead.
  const isWalletAccount = userData.authMethod === 'wallet';

  return (
    <div className="mx-auto max-w-[760px]">
      <h1 className="mb-[22px] font-display text-[26px] font-semibold leading-tight">
        Account settings
      </h1>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="appearance">Appearance</TabsTrigger>
          <TabsTrigger value="danger">Danger</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          {/* Nothing here is editable: username sign-in is off on the Clerk
              instance, so there is no username to change, and email changes
              go through Clerk. Wallet accounts have no email, so they see
              their identity key instead. */}
          {isWalletAccount && userData.identityKey ? (
            <BsvIdentityCard identityKey={userData.identityKey} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Profile information</CardTitle>
                <CardDescription>
                  The email address you sign in with.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    disabled
                    name="email"
                    type="email"
                    defaultValue={userData.email ?? ''}
                  />
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="appearance">
          <Card>
            <CardHeader>
              <CardTitle>Appearance</CardTitle>
              <CardDescription>
                Customize how the faucet looks to you.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-4 rounded-2xl border p-5">
                <div className="space-y-0.5">
                  <Label htmlFor="dark-mode">Dark mode</Label>
                  <p className="text-sm text-muted-foreground">
                    Turn on dark mode for a comfortable viewing experience in
                    low light.
                  </p>
                </div>
                <Switch
                  id="dark-mode"
                  checked={theme === 'dark'}
                  onCheckedChange={toggleTheme}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="danger">
          <Card className="border-destructive">
            <CardHeader>
              <CardTitle className="text-destructive">Danger zone</CardTitle>
              <CardDescription>
                Once you delete your account, there is no going back. Please be
                certain.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="mb-4 text-sm text-muted-foreground">
                Deleting your account will remove all of your information from
                our database. This cannot be undone.
              </p>
              {isWalletAccount ? (
                <WalletDeleteAccountButton
                  onDeleted={(message) => {
                    alert(message);
                    router.push('/');
                  }}
                  onError={setError}
                />
              ) : (
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  className="inline-flex h-11 items-center gap-2 rounded-full border-[1.5px] border-destructive bg-transparent px-5 text-sm font-medium text-destructive transition-colors hover:bg-destructive/10"
                >
                  <Trash2 className="h-4 w-4" /> Delete account
                </button>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
