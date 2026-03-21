"use client"

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle, Copy, RefreshCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

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
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  const fetchBalance = async () => {
    const balanceResponse = await fetch('/api/wallet/balance');
    const balanceData = await balanceResponse.json();
    if (!balanceResponse.ok) {
      throw new Error(balanceData?.error || 'Failed to fetch balance');
    }
    return balanceData.balance;
  };

  const fetchTransactions = async () => {
    const transactionsResponse = await fetch('/api/transactions');
    if (!transactionsResponse.ok) {
      throw new Error('Failed to fetch transactions');
    }
    return await transactionsResponse.json();
  };

  const fetchData = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Fetch balance first
      const balanceSatoshis = await fetchBalance();
      const balanceBSV = balanceSatoshis / 100000000; // Convert to BSV

      // Fetch transactions
      // const transactions = await fetchTransactions();

      // // Map transactions to a simpler format
      // const mappedTransactions = transactions.map((tx: any) => ({
      //   id: tx.txid,
      //   type: tx.txType,
      //   amount: tx.amount.toString(),
      //   description: `Transaction ID: ${tx.txid}`,
      //   timestamp: tx.date,
      //   beefTx: tx.beefTx,
      //   vout: tx.vout
      // }));

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

  const formatSatoshisToBSV = (satoshis: number) => {
    return (satoshis / 100000000).toFixed(8);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleMineBlock = () => {
    console.log('Mining block');
  };

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
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex w-full justify-between">
            <CardTitle>Treasury Balance</CardTitle>
            <div className="relative">
              <Button variant="outline" className={treasuryData.isLowBalance ? 'animate-pulse border-destructive' : ''} onClick={handleMineBlock}>
                <RefreshCcw className="w-4 h-4" /> Mine Block
              </Button>
              {treasuryData.isLowBalance && (
                <div className="absolute -top-2 -right-2 w-4 h-4 rounded-full animate-pulse">
                  <AlertTriangle className="w-4 h-4 text-destructive" />
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-secondary rounded-lg">
                <div className="text-sm font-medium">Balance (BSV)</div>
                <div className="text-2xl font-bold">
                  {treasuryData.balanceBSV.toFixed(8)}
                </div>
              </div>
              <div className="p-4 bg-secondary rounded-lg">
                <div className="text-sm font-medium">Balance (Satoshis)</div>
                <div className="text-2xl font-bold">
                  {Math.floor(treasuryData.balanceSatoshis).toLocaleString()}
                </div>
              </div>
            </div>

            {treasuryData.isLowBalance && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>Low Balance Warning</AlertTitle>
                <AlertDescription>
                  Treasury balance is below the threshold of {treasuryData.lowBalanceThreshold} BSV.
                  Please add funds to ensure continuous operation.
                </AlertDescription>
              </Alert>
            )}
          </div>
        </CardContent>
      </Card>

    </div>
  );
}