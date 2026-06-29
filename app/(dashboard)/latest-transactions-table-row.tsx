import { ClientUser, ClientTransaction } from '@/lib/prisma';
import { TableRow, TableCell } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';

const LatestTransactionsTableRow = ({
  user,
  transaction,
  showBeef = true
}: {
  user: ClientUser;
  transaction: ClientTransaction;
  showBeef?: boolean;
}) => {
  const isDeposit = transaction.txType === 'deposit';

  return (
    <TableRow>
      <TableCell className="max-w-40 truncate">
        <a
          href={`https://test.whatsonchain.com/tx/${transaction.txid}`}
          className="font-medium tabular-nums text-link hover:underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          {transaction.txid.substring(0, 8)}...
        </a>
      </TableCell>
      <TableCell className="text-muted-foreground" suppressHydrationWarning>
        {new Date(transaction.date).toLocaleString()}
      </TableCell>
      {user.role === 'admin' && (
        <TableCell>
          {isDeposit ? (
            <span className="text-muted-foreground">
              Admin · Treasury Wallet
            </span>
          ) : (
            transaction.user && (
              <div className="flex min-w-0 items-center gap-2.5">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={transaction.user.imageUrl} />
                  <AvatarFallback className="bg-primary text-xs font-medium text-primary-foreground">
                    {transaction.user.username?.charAt(0)?.toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex min-w-0 flex-col">
                  <span className="truncate font-medium leading-tight">
                    {transaction.user.username}
                  </span>
                  <span className="truncate text-[13px] text-muted-foreground">
                    {transaction.user.email}
                  </span>
                </div>
              </div>
            )
          )}
        </TableCell>
      )}
      <TableCell className="max-w-40 truncate">
        {showBeef ? (
          <a
            href={`https://beef.xn--nda.network/${transaction.beefTx.txid}`}
            className="font-medium text-link hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            View BEEF
          </a>
        ) : (
          'N/A'
        )}
      </TableCell>
      <TableCell>
        <Badge variant="muted">{transaction.txType}</Badge>
      </TableCell>
      <TableCell className="font-medium tabular-nums">
        {transaction.amount.toLocaleString()}
      </TableCell>
    </TableRow>
  );
};

export default LatestTransactionsTableRow;
