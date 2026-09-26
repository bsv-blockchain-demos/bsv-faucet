'use client';

import { useState, useEffect } from 'react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Copy, AlertCircle, ArrowUp } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { TablePagination } from '@/components/ui/table-pagination';
import useWalletMonitor from '@/hooks/useWalletMonitor';
import { toast } from '@/hooks/use-toast';

const PAGE_SIZE = 20;

interface Transaction {
  id: number;
  txid: string;
  txType: 'deposit';
  amount: string;
  date: string;
}

const TransactionSkeleton = () => (
  <div className="flex animate-pulse flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between">
    <div className="space-y-2">
      <Skeleton className="h-5 w-24" />
      <Skeleton className="h-4 w-48" />
    </div>
    <div className="flex items-center space-x-2">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="h-8 w-16" />
    </div>
  </div>
);

function RowCopyButton({
  label,
  onClick
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      className="shrink-0 rounded p-0.5 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Copy className="h-3.5 w-3.5" aria-hidden />
      <span className="sr-only">{label}</span>
    </button>
  );
}

export default function TreasuryDepositHistory() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(0);

  useWalletMonitor();

  useEffect(() => {
    const fetchTransactions = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/transactions');
        if (!response.ok) {
          throw new Error('Failed to fetch transactions');
        }
        const data: Transaction[] = await response.json();
        setTransactions(
          data.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        );
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'An error occurred while fetching transactions'
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchTransactions();
  }, []);

  // Toasts rather than an inline error, so copying from the list and from the
  // details dialog report the same way.
  const copied = (label: string) =>
    toast({ title: 'Copied to clipboard', description: `${label} copied` });
  const copyFailed = (label: string) =>
    toast({
      title: 'Error',
      description: `Failed to copy ${label}`,
      variant: 'destructive'
    });

  const copyToClipboard = (text: string) => {
    navigator.clipboard
      .writeText(text)
      .then(() => copied('Txid'), () => copyFailed('txid'));
  };

  const copyBeef = async (txid: string) => {
    // Safari drops clipboard access once the click handler awaits, so the
    // fetch goes to ClipboardItem as a promise instead of being awaited here.
    const beef = fetch(`/api/transactions/${txid}/beef`).then(async (response) => {
      if (!response.ok) throw new Error('BEEF request failed');
      return new Blob([await response.text()], { type: 'text/plain' });
    });
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'text/plain': beef })]);
      copied('BEEF');
    } catch {
      copyFailed('BEEF');
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const formatAmount = (amount: string) => {
    return (parseInt(amount) / 100000000).toFixed(8);
  };

  const handleDetailsClick = (tx: Transaction) => {
    setSelectedTransaction(tx);
  };

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertTitle>Error</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Treasury deposit history</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {isLoading ? (
            <>
              <TransactionSkeleton />
              <TransactionSkeleton />
              <TransactionSkeleton />
            </>
          ) : (
            <>
              {transactions
                .slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)
                .map((tx) => (
                  <div
                    key={tx.id}
                    className="lift flex flex-col gap-3 rounded-2xl border p-4 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
                  >
                    <div className="min-w-0">
                      <div className="mb-1 flex items-center gap-2.5">
                        <Badge variant="positive">
                          <ArrowUp className="h-3 w-3" />
                          Deposit
                        </Badge>
                        <span className="font-display text-base font-semibold">
                          + {formatAmount(tx.amount)} BSV
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5 font-mono text-[13px] text-muted-foreground">
                        <span>Txid: {tx.txid.substring(0, 8)}…</span>
                        <RowCopyButton
                          label="Copy txid"
                          onClick={() => copyToClipboard(tx.txid)}
                        />
                        <span aria-hidden>|</span>
                        <span>BEEF</span>
                        <RowCopyButton
                          label="Copy BEEF"
                          onClick={() => copyBeef(tx.txid)}
                        />
                      </div>
                    </div>
                    <div className="flex w-full items-center justify-between gap-4 sm:w-auto sm:shrink-0 sm:justify-end">
                      <div className="text-[13px] text-muted-foreground">
                        {formatDate(tx.date)}
                      </div>
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDetailsClick(tx)}
                          >
                            Details
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-[425px]">
                          <DialogHeader>
                            <DialogTitle>Transaction Details</DialogTitle>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor="date" className="text-right">
                                Date
                              </Label>
                              <Input
                                id="date"
                                value={selectedTransaction ? formatDate(selectedTransaction.date) : ''}
                                className="col-span-3"
                                readOnly
                              />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor="txid" className="text-right">
                                Txid
                              </Label>
                              <Input
                                id="txid"
                                value={selectedTransaction?.txid || ''}
                                className="col-span-3"
                                readOnly
                              />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                              <span className="text-right text-sm font-medium">
                                BEEF
                              </span>
                              <a
                                href={`/api/transactions/${selectedTransaction?.txid}/beef`}
                                className="col-span-3 text-sm font-medium text-link hover:underline"
                                target="_blank"
                                rel="noopener noreferrer"
                              >
                                View BEEF
                              </a>
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor="txType" className="text-right">
                                TX Type
                              </Label>
                              <Input
                                id="txType"
                                value={selectedTransaction?.txType || ''}
                                className="col-span-3"
                                readOnly
                              />
                            </div>
                            <div className="grid grid-cols-4 items-center gap-4">
                              <Label htmlFor="amount" className="text-right">
                                Amount
                              </Label>
                              <Input
                                id="amount"
                                value={
                                  selectedTransaction
                                    ? formatAmount(selectedTransaction.amount) + ' BSV'
                                    : ''
                                }
                                className="col-span-3"
                                readOnly
                              />
                            </div>
                          </div>
                          <div className="flex flex-wrap justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => copyToClipboard(selectedTransaction?.txid || '')}
                            >
                              <Copy className="mr-2 h-4 w-4" />
                              Copy Txid
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => selectedTransaction && copyBeef(selectedTransaction.txid)}
                              disabled={!selectedTransaction}
                            >
                              <Copy className="mr-2 h-4 w-4" />
                              Copy BEEF
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>
                ))}
              <TablePagination
                page={page}
                totalPages={Math.ceil(transactions.length / PAGE_SIZE)}
                totalItems={transactions.length}
                pageSize={PAGE_SIZE}
                onPageChange={setPage}
              />
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
