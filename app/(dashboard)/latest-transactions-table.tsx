'use client';

import { useState } from 'react';
import { ClientUser, ClientTransaction } from '@/lib/prisma';
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { TablePagination } from '@/components/ui/table-pagination';
import LatestTransactionsTableRow from './latest-transactions-table-row';

const PAGE_SIZE = 20;

const LatestTransactionsTable = ({
  user,
  transactions
}: {
  user: ClientUser;
  transactions: ClientTransaction[];
}) => {
  const [page, setPage] = useState(0);
  const totalPages = Math.ceil(transactions.length / PAGE_SIZE);
  const paginatedTransactions = transactions.slice(
    page * PAGE_SIZE,
    (page + 1) * PAGE_SIZE
  );

  return (
    <div>
      <Table className="overflow-x-auto">
        <TableHeader>
          <TableRow>
            <TableHead>Tx ID</TableHead>
            <TableHead>Date</TableHead>
            {user.role === 'admin' && <TableHead>Account</TableHead>}
            <TableHead>Beef Tx</TableHead>
            <TableHead>Tx Type</TableHead>
            <TableHead>Amount</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {paginatedTransactions.map((transaction) => (
            <LatestTransactionsTableRow
              key={transaction.txid}
              user={user}
              transaction={transaction}
            />
          ))}
        </TableBody>
      </Table>
      <TablePagination
        page={page}
        totalPages={totalPages}
        totalItems={transactions.length}
        pageSize={PAGE_SIZE}
        onPageChange={setPage}
      />
    </div>
  );
};

export default LatestTransactionsTable;
