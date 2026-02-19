'use client';

import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
// import ReCAPTCHA from 'react-google-recaptcha';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import {
  Timer,
  Wallet,
  History,
  AlertTriangle,
  LoaderIcon
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';
import { AdminWalletAddress } from '@/lib/utils';

interface Transaction {
  id: number;
  date: string;
  txid: string;
  amount: string;
  txType: string;
  vout: Array<{ address: string; satoshis: number }>;
  userId: string;
}

export default function DashboardPage() {
  const { user } = useUser();
  const [address, setAddress] = useState('');
  const [amount, setAmount] = useState('');
  // const [captchaValue, setCaptchaValue] = useState('');
  const [remainingTime, setRemainingTime] = useState(0);
  const [totalWithdrawn, setTotalWithdrawn] = useState(0);

  const [faucetBalance, setFaucetBalance] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // const RECAPTCHA_SITE_KEY = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || '';
  const MAX_DAILY_WITHDRAWAL = parseInt(
    process.env.NEXT_PUBLIC_MAX_DAILY_WITHDRAWAL || '1000000'
  );
  const treasuryWIF = process.env.NEXT_PUBLIC_TREASURY_WALLET_WIF;

  const adminWalletAddress = AdminWalletAddress();

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [balanceResponse, transactionsResponse, remainingTimeResponse] =
          await Promise.all([
            fetch('/api/wallet/balance'),
            fetch(`/api/transactions/users`),
            fetch(`/api/users/remaining-time?userId=${user?.id}`)
          ]);
        if (
          !balanceResponse.ok ||
          !transactionsResponse.ok ||
          !remainingTimeResponse.ok
        ) {
          throw new Error('Failed to fetch data');
        }

        const balanceData = await balanceResponse.json();
        const transactionsData = await transactionsResponse.json();
        const { remainingTime, totalAmountWithdrawn, message } =
          await remainingTimeResponse.json();
        setFaucetBalance(balanceData.balance);
        setTransactions(transactionsData);
        setRemainingTime(remainingTime);
        setTotalWithdrawn(totalAmountWithdrawn)
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load faucet data',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    const intervalId = setInterval(fetchData, 60000);

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (remainingTime <= 0) return;

    const timer = setInterval(() => {
      setRemainingTime((prevtime) => Math.max(0, prevtime - 1000));
    }, 1000);

    return () => clearInterval(timer);
  }, [remainingTime]);

  const isValidBSVAddress = (addr: string) =>
    /^[mn2][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(addr);

  const validateForm = () => {
    if (!user) return 'You must be logged in to request BSV';
    if (!isValidBSVAddress(address)) return 'Invalid BSV testnet address';
    if (
      !amount ||
      parseInt(amount) <= 0 ||
      parseInt(amount) > MAX_DAILY_WITHDRAWAL
    )
      return `Invalid amount (max ${MAX_DAILY_WITHDRAWAL} satoshis)`;
    // if (!captchaValue) return 'Please complete the captcha';
    if (remainingTime > 0)
      return 'Please wait for the cooldown period to end for this address';
    return null;
  };

  const handleRequest = async () => {
    setError('');
    setSuccess('');
    setIsLoading(true);

    const validationError = validateForm();
    if (validationError) {
      setError(validationError);
      setIsLoading(false);
      return;
    }

    try {
      const amountInSatoshis = parseInt(amount);

      const response = await fetch('/api/wallet/send', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          toAddress: address,
          amount: amountInSatoshis,
          wif: treasuryWIF
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        setIsLoading(false);
        throw new Error(errorData.error || 'Failed to send transaction');
      }

      const { txid, remainingTime: newRemainingTime } = await response.json();

      setSuccess(
        `Successfully sent ${amount} satoshis to ${address}. TxID: ${txid}`
      );

      setRemainingTime(newRemainingTime);

      // Refresh data after successful transaction
      const [balanceResponse, transactionsResponse] = await Promise.all([
        fetch('/api/wallet/balance'),
        fetch(`/api/transactions/users`)
      ]);

      if (balanceResponse.ok && transactionsResponse.ok) {
        const balanceData = await balanceResponse.json();
        const transactionsData = await transactionsResponse.json();
        setFaucetBalance(balanceData.balance);
        setTransactions(transactionsData);
        setIsLoading(false);
      }
    } catch (err: any) {
      setError(`Failed to process request: ${err.message}`);
      console.error('Transaction error:', err);
      setIsLoading(false);
    }
  };

  // const onCaptchaChange = (value: string | null) => {
  //  setCaptchaValue(value || '');
  // };

  const formatTimeRemaining = (time: number) => {
    const hours = Math.floor(time / (60 * 60 * 1000));
    const minutes = Math.floor((time % (60 * 60 * 1000)) / (60 * 1000));
    const seconds = Math.floor((time % (60 * 1000)) / 1000);
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>BSV Testnet Faucet</CardTitle>
          <CardDescription>Request testnet BSV tokens</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-secondary rounded-lg">
            <div className="flex items-center space-x-2">
              <Wallet className="h-5 w-5" />
              <span>Faucet Balance:</span>
            </div>
            {isLoading ? (
              <Skeleton className="h-6 w-24" />
            ) : (
              <span className="font-bold">{faucetBalance} satoshis</span>
            )}
          </div>

          <div className="space-y-4">
            <Input
              placeholder="Enter BSV testnet address"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
            <Input
              type="number"
              placeholder={`Amount (in satoshis, max ${MAX_DAILY_WITHDRAWAL})`}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              max={MAX_DAILY_WITHDRAWAL.toString()}
            />
            {/* <ReCAPTCHA
              sitekey={RECAPTCHA_SITE_KEY}
              onChange={onCaptchaChange}
            />
            */}

            {totalWithdrawn > MAX_DAILY_WITHDRAWAL && (
              <div className="flex items-center space-x-2 text-yellow-600">
                <Timer className="h-5 w-5" />
                <span>
                  Next request available for this address in:
                  {formatTimeRemaining(remainingTime)}
                </span>
              </div>
            )}

            <Button
              className="w-full flex items-center justify-center"
              onClick={handleRequest}
              disabled={totalWithdrawn > MAX_DAILY_WITHDRAWAL || isLoading}
              >
              {isLoading ? (
                <LoaderIcon className="animate-spin h-5 w-5 mr-2" />
              ) : (
                'Request BSV'
              )}
            </Button>
          </div>

          {error && (
            <p className="text-red-500" role="alert">
              <AlertTriangle className="inline h-4 w-4 mr-2" />
              {error}
            </p>
          )}
          {success && (
            <p className="text-green-500" role="status">
              <History className="inline h-4 w-4 mr-2" />
              {success}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Recent Transactions</CardTitle>
          <CardDescription>Last 5 faucet transactions</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Amount (satoshis)</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Transaction ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array(5)
                  .fill(0)
                  .map((_, index) => (
                    <TableRow key={index}>
                      <TableCell>
                        <Skeleton className="h-5 w-24" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-16" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-20" />
                      </TableCell>
                      <TableCell>
                        <Skeleton className="h-5 w-32" />
                      </TableCell>
                    </TableRow>
                  ))
              ) : transactions && transactions.length > 0 ? (
                transactions.slice(0, 5).map((tx) => (
                  <TableRow key={tx.id}>
                    <TableCell>
                      {new Date(tx.date).toLocaleDateString()}
                    </TableCell>
                    <TableCell>{tx.amount}</TableCell>
                    <TableCell>{tx.txType}</TableCell>
                    <TableCell>
                      <a
                        href={`https://test.whatsonchain.com/tx/${tx.txid}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 hover:underline"
                        title={`View Transaction ${tx.txid}`}
                      >
                        {tx.txid.substring(0, 8)}...
                      </a>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={4} className="text-center">
                    No transactions found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Donate to Faucet</CardTitle>
          <CardDescription>
            Donate unused BSV back to the Faucet.
          </CardDescription>
        </CardHeader>
        <CardContent className="h-full w-full flex items-center">
          <div className="p-4 rounded-lg">
            <div className="text-sm font-medium">Faucet Address</div>
            <p className="text-sm text-muted-foreground">
              Click to copy address, send unused BSV back to faucet address
            </p>
            <div
              className="text-xl text-center bg-secondary rounded-lg p-2 px-4 font-semibold"
              onClick={() => {
                navigator.clipboard.writeText(adminWalletAddress);
                toast({
                  title: 'Copied to clipboard',
                  description: `Faucet address copied to clipboard`
                });
              }}
            >
              {adminWalletAddress}
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
