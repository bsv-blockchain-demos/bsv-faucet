import { Suspense } from 'react'
import { format } from 'date-fns'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Skeleton } from '@/components/ui/skeleton'
import { DepositTransaction, getDepositHistory } from '@/lib/depositHistory'
import { Alert, AlertTitle, AlertDescription } from './ui/alert'
import { FileWarningIcon, RefreshCcwIcon } from 'lucide-react'

function DepositHistoryTable({ depositHistory }: { depositHistory: DepositTransaction[] }) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Date</TableHead>
          <TableHead>Txid</TableHead>
          <TableHead>Beef TX</TableHead>
          <TableHead>Vout</TableHead>
          <TableHead>TX Type</TableHead>
          <TableHead className="text-right">Amount (BSV)</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {depositHistory.map((transaction, index) => (
          <TableRow key={index}>
            <TableCell>{format(new Date(transaction.date), 'yyyy-MM-dd HH:mm:ss')}</TableCell>
            <TableCell className="font-mono">{transaction.txid.slice(0, 10)}...</TableCell>
            <TableCell className="font-mono">{transaction.beefTx.slice(0, 10)}...</TableCell>
            <TableCell>{transaction.vout}</TableCell>
            <TableCell>{transaction.txType}</TableCell>
            <TableCell className="text-right">{(transaction.amount / 100000000).toFixed(8)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

function LoadingState() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-4 w-[250px]" />
      <Skeleton className="h-4 w-[200px]" />
      <Skeleton className="h-4 w-[150px]" />
      <Skeleton className="h-4 w-[200px]" />
    </div>
  )
}

function ErrorState({ error }: { error: Error }) {
  return (
    <Alert variant="destructive">
      <FileWarningIcon className="h-4 w-4" />
      <AlertTitle>Error</AlertTitle>
      <AlertDescription>
        {error.message}
        <button 
          onClick={() => window.location.reload()} 
          className="ml-2 inline-flex items-center px-2 py-1 border border-transparent text-xs font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
        >
          <RefreshCcwIcon className="h-4 w-4 mr-1" /> Retry
        </button>
      </AlertDescription>
    </Alert>
  )
}

export default async function AdminTreasuryHistory() {
  const depositHistoryPromise = getDepositHistory()

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="text-2xl font-bold">Treasury - Deposit History</CardTitle>
        <CardDescription>View all deposit transactions in the treasury</CardDescription>
      </CardHeader>
      <CardContent>
        <Suspense fallback={<LoadingState />}>
          <DepositHistoryContent promise={depositHistoryPromise} />
        </Suspense>
      </CardContent>
    </Card>
  )
}

async function DepositHistoryContent({ promise }: { promise: Promise<DepositTransaction[]> }) {
  try {
    const depositHistory = await promise
    return <DepositHistoryTable depositHistory={depositHistory} />
  } catch (error) {
    return <ErrorState error={error instanceof Error ? error : new Error('Unknown error')} />
  }
}