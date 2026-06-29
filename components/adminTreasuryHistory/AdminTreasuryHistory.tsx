'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger
} from '@/components/ui/tooltip';
import { Skeleton } from '@/components/ui/skeleton';

interface Transaction {
  id: string;
  type: 'deposit' | 'withdrawal';
  amount: string;
  description: string;
  timestamp: string;
  beefTx: string;
  vout: number;
}

interface TreasuryData {
  balanceBSV: number;
  balanceSatoshis: number;
  lowBalanceThreshold: number;
  isLowBalance: boolean;
  recentTransactions: Transaction[];
}

export default function AdminTreasury() {
  const [treasuryData, setTreasuryData] = useState<TreasuryData>({
    balanceBSV: 0,
    balanceSatoshis: 0,
    lowBalanceThreshold: 10,
    isLowBalance: false,
    recentTransactions: []
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalance = async () => {
    const balanceResponse = await fetch('/api/wallet/balance');
    const balanceData = await balanceResponse.json();
    if (!balanceResponse.ok) {
      throw new Error(balanceData?.error || 'Failed to fetch balance');
    }
    return balanceData.balance;
  };

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch balance first
      const balanceSatoshis = await fetchBalance();
      const balanceBSV = balanceSatoshis / 100000000; // Convert to BSV

      setTreasuryData({
        balanceBSV,
        balanceSatoshis,
        lowBalanceThreshold: 10,
        isLowBalance: balanceBSV < 10,
        recentTransactions: []
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch treasury data');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData(); // Initial fetch on mount
    const interval = setInterval(fetchData, 5 * 60 * 1000); // Refresh every 5 minutes

    return () => clearInterval(interval); // Cleanup on component unmount
  }, []);

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTriangle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex w-full items-center justify-between gap-4">
          <CardTitle>Treasury balance</CardTitle>
          <Tooltip>
            <TooltipTrigger asChild>
              <span tabIndex={0} className="inline-flex cursor-not-allowed">
                <Button
                  variant="outline"
                  disabled
                  className="pointer-events-none opacity-50"
                >
                  <RefreshCcw className="h-4 w-4" /> Mine block
                </Button>
              </span>
            </TooltipTrigger>
            <TooltipContent>Not available in this environment</TooltipContent>
          </Tooltip>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-[18px] max-[560px]:grid-cols-1">
            <div className="rounded-2xl bg-muted p-[22px]">
              <div className="mb-2.5 text-[13px] font-medium text-muted-foreground">
                Balance (BSV)
              </div>
              {isLoading ? (
                <Skeleton className="h-8 w-40" />
              ) : (
                <div className="font-display text-[26px] font-semibold tabular-nums">
                  {treasuryData.balanceBSV.toFixed(8)}
                </div>
              )}
            </div>
            <div className="rounded-2xl bg-muted p-[22px]">
              <div className="mb-2.5 text-[13px] font-medium text-muted-foreground">
                Balance (satoshis)
              </div>
              {isLoading ? (
                <Skeleton className="h-8 w-40" />
              ) : (
                <div className="font-display text-[26px] font-semibold tabular-nums">
                  {Math.floor(treasuryData.balanceSatoshis).toLocaleString()}
                </div>
              )}
            </div>
          </div>

          {treasuryData.isLowBalance && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertTitle>Low Balance Warning</AlertTitle>
              <AlertDescription>
                Treasury balance is below the threshold of{' '}
                {treasuryData.lowBalanceThreshold} BSV. Please add funds to
                ensure continuous operation.
              </AlertDescription>
            </Alert>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
