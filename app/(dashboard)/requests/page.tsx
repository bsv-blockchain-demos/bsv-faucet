import Toolbar from './toolbar';
import {
  fetchUser,
  fetchTransactions,
  serializeUser,
  serializeTransactions
} from '@/lib/prisma';
import LatestTransactionsTable from '../latest-transactions-table';
import SpentStatusMonitorClient from '../SpentStatusMonitorClient';

export default async function RequestsPage() {
  const user = await fetchUser();
  if (!user) {
    return null;
  }
  const transactions = await fetchTransactions(user);
  return (
    <section className="rounded-[20px] border bg-card p-5 sm:p-7">
      <div className="mb-[22px]">
        <h1 className="font-display text-[26px] font-semibold leading-tight">
          Requests
        </h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">
          All faucet withdrawal requests.
        </p>
      </div>
      <Toolbar />
      <LatestTransactionsTable
        user={serializeUser(user)}
        transactions={serializeTransactions(transactions)}
      />
      <SpentStatusMonitorClient />
    </section>
  );
}
