'use client';

import React, { useState, useEffect } from 'react';
import { useUser } from '@clerk/nextjs';
// import ReCAPTCHA from 'react-google-recaptcha';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Timer, AlertTriangle, CheckCircle2, Copy } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Skeleton } from '@/components/ui/skeleton';

interface Transaction {
  id: number;
  date: string;
  txid: string;
  amount: string;
  txType: string;
  vout: Array<{ address: string; satoshis: number }>;
  userId: string;
}

function MetricTile({
  label,
  value,
  unit,
  loading
}: {
  label: string;
  value: number | null;
  unit: string;
  loading: boolean;
}) {
  return (
    <div className="lift rounded-2xl border bg-card p-[22px]">
      <div className="mb-2.5 text-[13px] font-medium text-muted-foreground">
        {label}
      </div>
      {loading ? (
        <Skeleton className="h-7 w-32" />
      ) : (
        <div className="font-display text-2xl font-semibold tabular-nums">
          {(value ?? 0).toLocaleString()}{' '}
          <span className="font-sans text-sm text-muted-foreground">{unit}</span>
        </div>
      )}
    </div>
  );
}

function LimitRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b py-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
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

  const [adminWalletAddress, setAdminWalletAddress] = useState('');

  // The treasury WIF is server-only. Fetch the derived public address instead
  // of deriving it on the client.
  useEffect(() => {
    fetch('/api/wallet/treasury-address')
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.address) setAdminWalletAddress(data.address);
      })
      .catch((err) => console.error('Error fetching treasury address:', err));
  }, []);

  useEffect(() => {
    if (!user?.id) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [balanceResponse, transactionsResponse, remainingTimeResponse] =
          await Promise.all([
            fetch('/api/wallet/balance'),
            fetch(`/api/transactions/users`),
            fetch(`/api/users/remaining-time?userId=${user.id}`)
          ]);
        const balanceData = await balanceResponse.json();
        const transactionsData = transactionsResponse.ok ? await transactionsResponse.json() : [];
        const remainingData = remainingTimeResponse.ok ? await remainingTimeResponse.json() : {};

        if (!balanceResponse.ok) {
          toast({
            title: 'Balance Unavailable',
            description: balanceData?.error || 'Unable to fetch wallet balance. The blockchain provider may be temporarily down.',
            variant: 'destructive'
          });
        }

        setFaucetBalance(balanceData.balance ?? 0);
        setTransactions(transactionsData);
        setRemainingTime(remainingData.remainingTime ?? 0);
        setTotalWithdrawn(remainingData.totalAmountWithdrawn ?? 0);
      } catch (error) {
        console.error('Error fetching data:', error);
        toast({
          title: 'Error',
          description: 'Failed to load faucet data. Please try again later.',
          variant: 'destructive'
        });
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
    const intervalId = setInterval(fetchData, 60000);

    return () => clearInterval(intervalId);
  }, [user?.id]);

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
      return `Invalid amount (max ${MAX_DAILY_WITHDRAWAL.toLocaleString()} satoshis)`;
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
          amount: amountInSatoshis
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        setIsLoading(false);
        throw new Error(errorData.error || 'Failed to send transaction');
      }

      const { txid, remainingTime: newRemainingTime } = await response.json();

      setSuccess(
        `Successfully sent ${Number(amount).toLocaleString()} satoshis to ${address}. TxID: ${txid}`
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

  const copyFaucetAddress = () => {
    if (!adminWalletAddress) return;
    navigator.clipboard.writeText(adminWalletAddress);
    toast({
      title: 'Copied to clipboard',
      description: 'Faucet address copied to clipboard'
    });
  };

  return (
    <div className="stagger flex flex-col gap-7">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-[26px] font-semibold leading-tight">
            BSV Testnet Faucet
          </h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">
            Request testnet BSV tokens.
          </p>
        </div>
      </div>

      {/* Metrics tiles */}
      <div className="grid-stagger grid grid-cols-3 gap-[18px] max-[860px]:grid-cols-1">
        <MetricTile
          label="Faucet balance"
          value={faucetBalance}
          unit="satoshis"
          loading={isLoading}
        />
        <MetricTile
          label="Withdrawn today"
          value={totalWithdrawn}
          unit="sat"
          loading={isLoading}
        />
        <div className="lift rounded-2xl border bg-card p-[22px]">
          <div className="mb-2.5 text-[13px] font-medium text-muted-foreground">
            Daily limit
          </div>
          <div className="font-display text-2xl font-semibold tabular-nums">
            {MAX_DAILY_WITHDRAWAL.toLocaleString()}{' '}
            <span className="font-sans text-sm text-muted-foreground">sat</span>
          </div>
        </div>
      </div>

      {/* Request + donate/limits */}
      <div className="grid-stagger grid grid-cols-[1.4fr_1fr] items-stretch gap-6 max-[1100px]:grid-cols-1">
        {/* Request */}
        <section className="rounded-[20px] border bg-card p-7">
          <h2 className="font-display text-[20px] font-semibold">
            Request testnet BSV
          </h2>
          <p className="mb-5 mt-0.5 text-sm text-muted-foreground">
            Tokens are sent to the address you provide.
          </p>
          <div className="flex flex-col gap-3.5">
            <div>
              <label className="mb-[7px] block text-[13px] font-medium">
                Destination address
              </label>
              <Input
                placeholder="Enter BSV testnet address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
            <div>
              <label className="mb-[7px] block text-[13px] font-medium">
                Amount (max {MAX_DAILY_WITHDRAWAL.toLocaleString()} sat)
              </label>
              <Input
                type="text"
                inputMode="numeric"
                placeholder="Amount in satoshis"
                value={amount.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ''))}
              />
            </div>
            {/* <ReCAPTCHA sitekey={RECAPTCHA_SITE_KEY} onChange={onCaptchaChange} /> */}

            {totalWithdrawn > MAX_DAILY_WITHDRAWAL && (
              <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                <Timer className="h-4 w-4 shrink-0" />
                <span>
                  Next request available for this address in{' '}
                  {formatTimeRemaining(remainingTime)}
                </span>
              </div>
            )}

            <Button
              className="shine-loop mt-1 h-[50px] w-full text-base"
              onClick={handleRequest}
              disabled={totalWithdrawn > MAX_DAILY_WITHDRAWAL || isLoading}
            >
              {isLoading ? 'Requesting…' : 'Request BSV'}
            </Button>

            {error && (
              <p role="alert" className="flex items-start gap-2 text-sm text-negative">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="break-words">{error}</span>
              </p>
            )}
            {success && (
              <p role="status" className="flex items-start gap-2 text-sm text-positive">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="break-words">{success}</span>
              </p>
            )}
          </div>
        </section>

        {/* Donate + limits */}
        <div className="flex flex-col gap-6">
          <section className="rounded-[20px] border bg-card p-7">
            <h2 className="font-display text-[20px] font-semibold">
              Donate to faucet
            </h2>
            <p className="mb-[18px] mt-0.5 text-sm text-muted-foreground">
              Send unused testnet BSV back.
            </p>
            <div className="mb-2 text-[13px] font-medium">Faucet address</div>
            <button
              type="button"
              onClick={copyFaucetAddress}
              title="Copy faucet address"
              className="flex w-full items-center justify-between gap-2.5 rounded-xl bg-accent px-4 py-3.5 text-left text-accent-foreground transition-[filter] hover:brightness-[0.97]"
            >
              <span className="break-all font-mono text-[13px] font-semibold">
                {adminWalletAddress || '—'}
              </span>
              <Copy className="h-[18px] w-[18px] shrink-0" />
            </button>
          </section>

          <section className="flex flex-1 flex-col rounded-[20px] border bg-card p-7">
            <h2 className="mb-4 font-display text-[20px] font-semibold">
              Request limits
            </h2>
            <LimitRow
              label="Max per request"
              value={`${MAX_DAILY_WITHDRAWAL.toLocaleString()} sat`}
            />
            <LimitRow label="Cooldown" value="24 hours" />
            <div className="flex items-center justify-between py-3 text-sm">
              <span className="text-muted-foreground">Network</span>
              <Badge variant="muted">BSV Testnet</Badge>
            </div>
          </section>
        </div>
      </div>

      {/* Recent transactions */}
      <section className="rounded-[20px] border bg-card p-7">
        <h2 className="mb-[18px] font-display text-[20px] font-semibold">
          Recent transactions
        </h2>
        <div className="overflow-x-auto">
          <div className="min-w-[560px]">
            <div className="grid grid-cols-[1.2fr_1.2fr_1fr_1fr] gap-3 border-b px-1.5 pb-3 text-[13px] font-medium text-muted-foreground">
              <div>Date</div>
              <div>Amount (satoshis)</div>
              <div>Type</div>
              <div>Transaction ID</div>
            </div>
            {isLoading ? (
              Array(5)
                .fill(0)
                .map((_, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[1.2fr_1.2fr_1fr_1fr] items-center gap-3 border-b px-1.5 py-4"
                  >
                    <Skeleton className="h-5 w-24" />
                    <Skeleton className="h-5 w-16" />
                    <Skeleton className="h-5 w-20" />
                    <Skeleton className="h-5 w-32" />
                  </div>
                ))
            ) : transactions && transactions.length > 0 ? (
              transactions.slice(0, 5).map((tx) => (
                <div
                  key={tx.id}
                  className="trow grid grid-cols-[1.2fr_1.2fr_1fr_1fr] items-center gap-3 border-b px-1.5 py-4 text-[15px]"
                >
                  <div>{new Date(tx.date).toLocaleDateString()}</div>
                  <div className="font-medium tabular-nums">
                    {Number(tx.amount).toLocaleString()}
                  </div>
                  <div>
                    <Badge variant="muted">{tx.txType}</Badge>
                  </div>
                  <div>
                    <a
                      href={`https://test.whatsonchain.com/tx/${tx.txid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium tabular-nums text-link hover:underline"
                      title={`View Transaction ${tx.txid}`}
                    >
                      {tx.txid.substring(0, 8)}…
                    </a>
                  </div>
                </div>
              ))
            ) : (
              <div className="px-1.5 py-8 text-center text-sm text-muted-foreground">
                No transactions found
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
